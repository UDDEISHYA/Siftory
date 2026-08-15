from __future__ import annotations

import logging
import sys
from pathlib import Path

import duckdb
import pandas as pd

from web.config import WEB_DUCKDB_PATH, NOVAMART_DUCKDB_PATH

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

logger = logging.getLogger(__name__)

_profile_cache: dict[str, dict] = {}


def get_cached_profile(table_name: str, source: str) -> dict | None:
    key = f"{source}:{table_name}"
    return _profile_cache.get(key)


def profile_table(table_name: str, source: str = "upload") -> dict:
    # Route remote connections to lightweight profiler
    if source.startswith("conn:"):
        return _profile_remote_table(table_name, source[5:])

    db_path = NOVAMART_DUCKDB_PATH if source == "novamart_demo" else WEB_DUCKDB_PATH
    if not db_path.exists():
        return {"error": f"Database not found: {db_path}"}

    conn = duckdb.connect(str(db_path), read_only=True)
    try:
        tables = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
        if table_name not in tables:
            return {"error": f"Table '{table_name}' not found"}

        row_count = conn.execute(
            f"SELECT COUNT(*) FROM {table_name}"
        ).fetchone()[0]

        cols_raw = conn.execute(f"DESCRIBE {table_name}").fetchall()

        columns = []
        for col_name, col_type, nullable, *_ in cols_raw:
            null_count = conn.execute(
                f'SELECT COUNT(*) FROM {table_name} WHERE "{col_name}" IS NULL'
            ).fetchone()[0]
            null_pct = round((null_count / row_count * 100), 2) if row_count > 0 else 0.0

            n_unique = conn.execute(
                f'SELECT COUNT(DISTINCT "{col_name}") FROM {table_name}'
            ).fetchone()[0]

            sample_rows = conn.execute(
                f'SELECT DISTINCT "{col_name}" FROM {table_name} '
                f'WHERE "{col_name}" IS NOT NULL LIMIT 5'
            ).fetchall()
            sample_values = [r[0] for r in sample_rows]
            for i, v in enumerate(sample_values):
                if isinstance(v, (pd.Timestamp,)):
                    sample_values[i] = str(v)
                elif hasattr(v, "item"):
                    sample_values[i] = v.item()

            min_val = None
            max_val = None
            type_lower = col_type.lower()
            if any(t in type_lower for t in ("int", "float", "double", "decimal", "numeric", "bigint")):
                try:
                    result = conn.execute(
                        f'SELECT MIN("{col_name}"), MAX("{col_name}") FROM {table_name}'
                    ).fetchone()
                    min_val = result[0]
                    max_val = result[1]
                    if hasattr(min_val, "item"):
                        min_val = min_val.item()
                    if hasattr(max_val, "item"):
                        max_val = max_val.item()
                except Exception:
                    pass
            elif any(t in type_lower for t in ("date", "time", "timestamp")):
                try:
                    result = conn.execute(
                        f'SELECT MIN("{col_name}"), MAX("{col_name}") FROM {table_name}'
                    ).fetchone()
                    min_val = str(result[0]) if result[0] else None
                    max_val = str(result[1]) if result[1] else None
                except Exception:
                    pass

            columns.append({
                "name": col_name,
                "type": col_type,
                "nullable": nullable == "YES",
                "null_count": null_count,
                "null_pct": null_pct,
                "n_unique": n_unique,
                "sample_values": sample_values,
                "min_val": min_val,
                "max_val": max_val,
            })

        quality = _assess_quality(columns, row_count)

        result = {
            "dataset": source,
            "tables": [{
                "name": table_name,
                "row_count": row_count,
                "columns": columns,
            }],
            "quality": quality,
        }
        _profile_cache[f"{source}:{table_name}"] = result
        return result
    finally:
        conn.close()


def profile_all_tables(source: str = "upload") -> dict:
    db_path = NOVAMART_DUCKDB_PATH if source == "novamart_demo" else WEB_DUCKDB_PATH
    if not db_path.exists():
        return {"error": f"Database not found: {db_path}"}

    conn = duckdb.connect(str(db_path), read_only=True)
    try:
        tables_list = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
    finally:
        conn.close()

    all_tables = []
    for tbl in tables_list:
        result = profile_table(tbl, source)
        if "tables" in result:
            all_tables.extend(result["tables"])

    return {
        "dataset": source,
        "table_count": len(all_tables),
        "total_rows": sum(t["row_count"] for t in all_tables),
        "tables": all_tables,
    }


def _assess_quality(columns: list[dict], row_count: int) -> dict:
    high_null_cols = [c["name"] for c in columns if c["null_pct"] > 5.0]
    low_cardinality = [
        c["name"] for c in columns
        if c["n_unique"] <= 1 and row_count > 10
    ]

    issues = []
    if high_null_cols:
        issues.append({
            "severity": "warning",
            "message": f"High null rate (>5%) in: {', '.join(high_null_cols)}",
        })
    if low_cardinality:
        issues.append({
            "severity": "info",
            "message": f"Constant or near-constant columns: {', '.join(low_cardinality)}",
        })

    if not issues:
        grade = "good"
    elif any(i["severity"] == "warning" for i in issues):
        grade = "fair"
    else:
        grade = "good"

    return {
        "grade": grade,
        "row_count": row_count,
        "column_count": len(columns),
        "issues": issues,
    }


def _profile_remote_table(table_name: str, connection_id: str) -> dict:
    """Profile a table from a remote connection (lighter than DuckDB profiling)."""
    try:
        from web.services.connection_service import get_connection_manager
        mgr = get_connection_manager(connection_id)

        # Get schema info
        schema = mgr.get_table_schema(table_name)

        # Get row count
        try:
            count_df = mgr.query(f"SELECT COUNT(*) AS cnt FROM {table_name}", log=False)
            row_count = int(count_df.iloc[0, 0]) if len(count_df) > 0 else 0
        except Exception:
            row_count = -1

        columns = []
        for col in schema:
            columns.append({
                "name": col.get("name", col.get("column_name", "")),
                "type": col.get("type", col.get("data_type", "unknown")),
                "nullable": True,
                "null_count": 0,
                "null_pct": 0.0,
                "n_unique": 0,
                "sample_values": [],
                "min_val": None,
                "max_val": None,
            })

        quality = _assess_quality(columns, row_count)

        result = {
            "dataset": f"conn:{connection_id}",
            "tables": [{
                "name": table_name,
                "row_count": row_count,
                "columns": columns,
            }],
            "quality": quality,
            "note": "Remote profile — null/unique analysis available on demand",
        }
        _profile_cache[f"conn:{connection_id}:{table_name}"] = result
        return result

    except Exception as e:
        return {"error": f"Failed to profile remote table: {e}"}


def warm_cache() -> None:
    if not NOVAMART_DUCKDB_PATH.exists():
        return
    try:
        conn = duckdb.connect(str(NOVAMART_DUCKDB_PATH), read_only=True)
        tables = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
        conn.close()
        for tbl in tables:
            profile_table(tbl, "novamart_demo")
        logger.info("Pre-cached profiles for %d NovaMart tables", len(tables))
    except Exception as e:
        logger.warning("Failed to warm profile cache: %s", e)
