from __future__ import annotations

import re
import time

import duckdb
import pandas as pd

from web.config import WEB_DUCKDB_PATH, NOVAMART_DUCKDB_PATH

_FORBIDDEN = re.compile(
    r"\b(DROP|ALTER|DELETE|UPDATE|INSERT|CREATE|TRUNCATE|GRANT|REVOKE|EXEC)\b",
    re.IGNORECASE,
)


def _resolve_db(source: str):
    if source == "novamart_demo":
        return NOVAMART_DUCKDB_PATH
    return WEB_DUCKDB_PATH


def _df_to_result(df: pd.DataFrame, elapsed: float, max_rows: int) -> dict:
    """Convert a DataFrame to the standard result dict shape."""
    total_rows = len(df)
    df_display = df.head(max_rows)

    columns = df_display.columns.tolist()
    rows = []
    for _, row in df_display.iterrows():
        row_vals = []
        for v in row:
            if pd.isna(v):
                row_vals.append(None)
            elif hasattr(v, "isoformat"):
                row_vals.append(v.isoformat())
            elif hasattr(v, "item"):
                row_vals.append(v.item())
            else:
                row_vals.append(v)
        rows.append(row_vals)

    return {
        "error": False,
        "columns": columns,
        "rows": rows,
        "row_count": total_rows,
        "execution_ms": round(elapsed, 1),
    }


def _error_result(msg: str) -> dict:
    """Build an error result dict."""
    return {
        "error": True,
        "message": msg,
        "columns": [],
        "rows": [],
        "row_count": 0,
        "execution_ms": 0,
    }


def _execute_remote(sql: str, connection_id: str, max_rows: int = 1000) -> dict:
    """Execute SQL against a remote connection via ConnectionManager."""
    from web.services import connection_service

    try:
        mgr = connection_service.get_connection_manager(connection_id)
        t0 = time.perf_counter()
        df = mgr.query(sql, log=False)
        elapsed = (time.perf_counter() - t0) * 1000
        mgr.close()
        result = _df_to_result(df, elapsed, max_rows)
        if result["row_count"] == 0:
            result["hint"] = (
                "Query returned 0 rows. This usually means the date range or "
                "filter values don't match the actual data. Run a recon query "
                "(SELECT MIN/MAX of the date column) to discover the correct range."
            )
        return result
    except ValueError as exc:
        return _error_result(str(exc))
    except Exception as exc:
        msg = str(exc)
        if "does not exist" in msg.lower() or "not found" in msg.lower():
            hint = " — check the table/column name against the schema."
        elif "syntax error" in msg.lower():
            hint = " — check your SQL syntax."
        elif "ambiguous" in msg.lower():
            hint = " — qualify the column with its table name."
        elif "group by" in msg.lower() or "binder error" in msg.lower():
            hint = (
                " — add the non-aggregated column to the GROUP BY clause, "
                "or wrap it in an aggregate function."
            )
        else:
            hint = ""
        return _error_result(msg + hint)


def execute_sql(sql: str, source: str = "upload", max_rows: int = 1000) -> dict:
    sql = sql.strip().rstrip(";")

    if _FORBIDDEN.search(sql):
        return _error_result("Only SELECT and WITH (CTE) queries are allowed.")

    # Remote connection dispatch
    if source.startswith("conn:"):
        connection_id = source[5:]  # strip "conn:" prefix
        return _execute_remote(sql, connection_id, max_rows)

    db_path = _resolve_db(source)
    if not db_path.exists():
        return _error_result(f"Database not found at {db_path}")

    conn = duckdb.connect(str(db_path), read_only=True)
    try:
        t0 = time.perf_counter()
        df = conn.execute(sql).fetchdf()
        elapsed = (time.perf_counter() - t0) * 1000
        result = _df_to_result(df, elapsed, max_rows)

        # Add a hint if 0 rows returned — likely wrong date range
        if result["row_count"] == 0:
            result["hint"] = (
                "Query returned 0 rows. This usually means the date range or "
                "filter values don't match the actual data. Run a recon query "
                "(SELECT MIN/MAX of the date column) to discover the correct range."
            )

        return result
    except Exception as e:
        msg = str(e)
        if "does not exist" in msg.lower() or "not found" in msg.lower():
            hint = " — check the table/column name against the schema."
        elif "syntax error" in msg.lower():
            hint = " — check your SQL syntax (DuckDB dialect)."
        elif "ambiguous" in msg.lower():
            hint = " — qualify the column with its table name."
        elif "group by" in msg.lower() or "binder error" in msg.lower():
            hint = (
                " — add the non-aggregated column to the GROUP BY clause, "
                "or wrap it in an aggregate function."
            )
        else:
            hint = ""
        return _error_result(msg + hint)
    finally:
        conn.close()


def _get_remote_schema_context(connection_id: str) -> str:
    """Build a schema context string from a remote connection."""
    from web.services import connection_service

    try:
        mgr = connection_service.get_connection_manager(connection_id)
        mgr.connect()
        tables = mgr.list_tables()
        if not tables:
            mgr.close()
            return "No tables found in this connection."

        lines = []
        for tbl in tables:
            cols = mgr.get_table_schema(tbl)
            col_defs = ", ".join(f"{c['name']} {c['type']}" for c in cols)
            lines.append(f"  {tbl}: {col_defs}")
        mgr.close()
        return "Tables:\n" + "\n".join(lines)
    except Exception as exc:
        return f"Could not retrieve schema: {exc}"


def get_multi_schema_context(sources: list[str]) -> str:
    """Build combined schema context from multiple sources."""
    if len(sources) == 1:
        return get_schema_context(sources[0])

    parts = []
    for source in sources:
        label = _source_label(source)
        schema = get_schema_context(source)
        parts.append(f"### Database: {label} (source: {source})\n{schema}")

    return "\n\n---\n\n".join(parts)


def get_schemas_by_source(sources: list[str]) -> dict[str, str]:
    """Return a dict mapping source identifier to its schema context."""
    return {s: get_schema_context(s) for s in sources}


def _source_label(source: str) -> str:
    """Human-readable label for a source."""
    if source == "upload":
        return "Uploaded Data (DuckDB)"
    if source == "novamart_demo":
        return "NovaMart Demo (DuckDB)"
    if source.startswith("conn:"):
        conn_id = source[5:]
        try:
            from web.services import connection_service
            conns = connection_service.list_connections()
            for c in conns:
                if c["id"] == conn_id:
                    return f"{c.get('display_name', conn_id)} ({c.get('provider', 'external')})"
        except Exception:
            pass
        return f"Connection: {conn_id}"
    return source


def get_schema_context(source: str = "upload") -> str:
    # Remote connection dispatch
    if source.startswith("conn:"):
        connection_id = source[5:]
        return _get_remote_schema_context(connection_id)

    db_path = _resolve_db(source)
    if not db_path.exists():
        return "No database available."

    conn = duckdb.connect(str(db_path), read_only=True)
    try:
        tables = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
        lines = []
        for tbl in tables:
            cols = conn.execute(f"DESCRIBE \"{tbl}\"").fetchall()
            row_count = conn.execute(f"SELECT COUNT(*) FROM \"{tbl}\"").fetchone()[0]
            col_defs = ", ".join(f"{c[0]} {c[1]}" for c in cols)
            lines.append(f"  {tbl} ({row_count:,} rows): {col_defs}")

            # Add date ranges for temporal columns
            date_details = []
            for c in cols:
                col_name, col_type = c[0], c[1].upper()
                is_temporal = (
                    "DATE" in col_type or "TIME" in col_type or "TIMESTAMP" in col_type
                    or "date" in col_name.lower()
                )
                if is_temporal and row_count > 0:
                    try:
                        r = conn.execute(
                            f'SELECT MIN("{col_name}"), MAX("{col_name}") FROM "{tbl}"'
                        ).fetchone()
                        if r[0] is not None:
                            min_val = r[0].isoformat() if hasattr(r[0], "isoformat") else str(r[0])
                            max_val = r[1].isoformat() if hasattr(r[1], "isoformat") else str(r[1])
                            date_details.append(f"    ⏱ {col_name}: {min_val} → {max_val}")
                    except Exception:
                        pass

            # Add sample values for categorical columns (low-cardinality)
            cat_details = []
            for c in cols:
                col_name, col_type = c[0], c[1].upper()
                is_text = "VARCHAR" in col_type or "TEXT" in col_type or "STRING" in col_type
                if is_text and row_count > 0:
                    try:
                        distinct_r = conn.execute(
                            f'SELECT COUNT(DISTINCT "{col_name}") FROM "{tbl}"'
                        ).fetchone()
                        n_distinct = distinct_r[0]
                        if n_distinct and 1 < n_distinct <= 30:
                            vals = conn.execute(
                                f'SELECT DISTINCT "{col_name}" FROM "{tbl}" '
                                f'WHERE "{col_name}" IS NOT NULL ORDER BY 1 LIMIT 15'
                            ).fetchall()
                            val_list = ", ".join(repr(v[0]) for v in vals)
                            suffix = f" ... ({n_distinct} total)" if n_distinct > 15 else ""
                            cat_details.append(
                                f"    📋 {col_name} ({n_distinct} values): [{val_list}{suffix}]"
                            )
                    except Exception:
                        pass

            if date_details or cat_details:
                lines.extend(date_details)
                lines.extend(cat_details)

        return "Tables:\n" + "\n".join(lines)
    finally:
        conn.close()
