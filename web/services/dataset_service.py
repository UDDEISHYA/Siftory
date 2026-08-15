from __future__ import annotations

import re
import threading
from pathlib import Path

import duckdb
import pandas as pd

from web.config import WEB_DUCKDB_PATH, NOVAMART_DUCKDB_PATH

_write_lock = threading.Lock()


def _sanitize_table_name(name: str) -> str:
    name = Path(name).stem
    name = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_").lower()
    if not name or name[0].isdigit():
        name = "t_" + name
    return name


def _make_connection_config(duckdb_path: str | Path) -> dict:
    return {
        "type": "duckdb",
        "dataset_id": "web_upload",
        "display_name": "Web Upload",
        "schema_prefix": "",
        "duckdb_path": str(duckdb_path),
        "csv_path": None,
        "connection": {},
    }


def get_web_config() -> dict:
    return _make_connection_config(WEB_DUCKDB_PATH)


def get_novamart_config() -> dict:
    return _make_connection_config(NOVAMART_DUCKDB_PATH)


def ingest_csv(file_path: Path, original_filename: str) -> dict:
    table_name = _sanitize_table_name(original_filename)

    with _write_lock:
        conn = duckdb.connect(str(WEB_DUCKDB_PATH), read_only=False)
        try:
            existing = [
                r[0] for r in conn.execute("SHOW TABLES").fetchall()
            ]
            if table_name in existing:
                base = table_name
                i = 2
                while table_name in existing:
                    table_name = f"{base}_{i}"
                    i += 1

            safe_path = str(file_path).replace("'", "''")
            conn.execute(
                f"CREATE TABLE {table_name} AS "
                f"SELECT * FROM read_csv_auto('{safe_path}', header=true)"
            )
            row_count = conn.execute(
                f"SELECT COUNT(*) FROM {table_name}"
            ).fetchone()[0]

            cols_raw = conn.execute(
                f"DESCRIBE {table_name}"
            ).fetchall()
            columns = [
                {"name": c[0], "type": c[1], "nullable": c[2] == "YES"}
                for c in cols_raw
            ]
        finally:
            conn.close()

    return {
        "table_name": table_name,
        "row_count": row_count,
        "columns": columns,
    }


def list_datasets() -> list[dict]:
    datasets = []

    if WEB_DUCKDB_PATH.exists():
        conn = duckdb.connect(str(WEB_DUCKDB_PATH), read_only=True)
        try:
            for (tbl,) in conn.execute("SHOW TABLES").fetchall():
                row_count = conn.execute(
                    f"SELECT COUNT(*) FROM {tbl}"
                ).fetchone()[0]
                cols = conn.execute(f"DESCRIBE {tbl}").fetchall()
                datasets.append({
                    "table_name": tbl,
                    "source": "upload",
                    "row_count": row_count,
                    "column_count": len(cols),
                    "columns": [
                        {"name": c[0], "type": c[1], "nullable": c[2] == "YES"}
                        for c in cols
                    ],
                })
        finally:
            conn.close()

    if NOVAMART_DUCKDB_PATH.exists():
        conn = duckdb.connect(str(NOVAMART_DUCKDB_PATH), read_only=True)
        try:
            for (tbl,) in conn.execute("SHOW TABLES").fetchall():
                row_count = conn.execute(
                    f"SELECT COUNT(*) FROM {tbl}"
                ).fetchone()[0]
                cols = conn.execute(f"DESCRIBE {tbl}").fetchall()
                datasets.append({
                    "table_name": tbl,
                    "source": "novamart_demo",
                    "row_count": row_count,
                    "column_count": len(cols),
                    "columns": [
                        {"name": c[0], "type": c[1], "nullable": c[2] == "YES"}
                        for c in cols
                    ],
                })
        finally:
            conn.close()

    # Append tables from remote connections
    try:
        from web.services import connection_service
        for remote_conn in connection_service.list_connections():
            conn_id = remote_conn["id"]
            try:
                mgr = connection_service.get_connection_manager(conn_id)
                mgr.connect()
                for tbl in mgr.list_tables():
                    cols = mgr.get_table_schema(tbl)
                    datasets.append({
                        "table_name": tbl,
                        "source": f"conn:{conn_id}",
                        "row_count": -1,  # skip COUNT(*) for remote — too expensive
                        "column_count": len(cols),
                        "columns": cols,
                    })
                mgr.close()
            except Exception:
                # Connection may be misconfigured or offline — skip silently
                pass
    except Exception:
        pass

    return datasets


def get_dataset_info(table_name: str, source: str = "upload") -> dict | None:
    db_path = NOVAMART_DUCKDB_PATH if source == "novamart_demo" else WEB_DUCKDB_PATH
    if not db_path.exists():
        return None

    conn = duckdb.connect(str(db_path), read_only=True)
    try:
        tables = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
        if table_name not in tables:
            return None

        row_count = conn.execute(
            f"SELECT COUNT(*) FROM {table_name}"
        ).fetchone()[0]
        cols = conn.execute(f"DESCRIBE {table_name}").fetchall()
        sample = conn.execute(
            f"SELECT * FROM {table_name} LIMIT 20"
        ).fetchdf()

        return {
            "table_name": table_name,
            "source": source,
            "row_count": row_count,
            "column_count": len(cols),
            "columns": [
                {"name": c[0], "type": c[1], "nullable": c[2] == "YES"}
                for c in cols
            ],
            "sample_rows": sample.fillna("").to_dict(orient="records"),
        }
    finally:
        conn.close()


def delete_dataset(table_name: str) -> bool:
    if not WEB_DUCKDB_PATH.exists():
        return False
    with _write_lock:
        conn = duckdb.connect(str(WEB_DUCKDB_PATH), read_only=False)
        try:
            tables = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
            if table_name not in tables:
                return False
            conn.execute(f"DROP TABLE {table_name}")
            return True
        finally:
            conn.close()
