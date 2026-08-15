"""
Connection Service — manage external database connections (Snowflake, Databricks, Postgres).

Stores connection metadata in data/connections.json.
Stores credentials in .env via python-dotenv (never in the JSON).
Provides ConnectionManager instances for query execution.
"""
from __future__ import annotations

import json
import logging
import sys
import threading
from pathlib import Path
from typing import Any

from dotenv import set_key, unset_key

from web.config import CONNECTIONS_CONFIG_PATH, ENV_FILE_PATH

# Add project root to path so helpers can be imported
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from helpers.connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Provider schemas — define required/optional fields per provider type
# ---------------------------------------------------------------------------

PROVIDER_SCHEMAS: dict[str, dict[str, Any]] = {
    "snowflake": {
        "display_name": "Snowflake",
        "fields": [
            {"key": "account", "label": "Account Identifier", "required": True, "secret": False},
            {"key": "user", "label": "Username", "required": True, "secret": False},
            {"key": "password", "label": "Password", "required": True, "secret": True},
            {"key": "warehouse", "label": "Warehouse", "required": True, "secret": False},
            {"key": "database", "label": "Database", "required": True, "secret": False},
            {"key": "schema", "label": "Schema", "required": False, "secret": False, "default": "public"},
            {"key": "role", "label": "Role", "required": False, "secret": False},
        ],
    },
    "databricks": {
        "display_name": "Databricks",
        "fields": [
            {"key": "server_hostname", "label": "Server Hostname", "required": True, "secret": False},
            {"key": "http_path", "label": "HTTP Path", "required": True, "secret": False},
            {"key": "access_token", "label": "Access Token", "required": True, "secret": True},
            {"key": "catalog", "label": "Catalog", "required": False, "secret": False},
            {"key": "schema", "label": "Schema", "required": False, "secret": False, "default": "default"},
        ],
    },
    "postgres": {
        "display_name": "PostgreSQL",
        "fields": [
            {"key": "host", "label": "Host", "required": True, "secret": False},
            {"key": "port", "label": "Port", "required": False, "secret": False, "default": "5432"},
            {"key": "database", "label": "Database", "required": True, "secret": False},
            {"key": "user", "label": "Username", "required": True, "secret": False},
            {"key": "password", "label": "Password", "required": True, "secret": True},
            {"key": "schema", "label": "Schema", "required": False, "secret": False, "default": "public"},
        ],
    },
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _read_connections() -> dict[str, dict]:
    """Read connections.json, returning {} if missing or invalid."""
    if not CONNECTIONS_CONFIG_PATH.exists():
        return {}
    try:
        data = json.loads(CONNECTIONS_CONFIG_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _write_connections(data: dict[str, dict]) -> None:
    """Write connections.json atomically (under lock)."""
    CONNECTIONS_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONNECTIONS_CONFIG_PATH.write_text(
        json.dumps(data, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _env_key(connection_id: str, field: str) -> str:
    """Build the .env variable name: CONN_{ID}_{FIELD} (uppercased)."""
    return f"CONN_{connection_id.upper()}_{field.upper()}"


def _ensure_env_file() -> None:
    """Create .env if it does not exist."""
    if not ENV_FILE_PATH.exists():
        ENV_FILE_PATH.touch()


# ---------------------------------------------------------------------------
# Integration helpers
# ---------------------------------------------------------------------------

def _check_notion_status() -> dict | None:
    """Check if Notion MCP is configured and return integration entry."""
    mcp_path = Path(__file__).resolve().parent.parent.parent / ".mcp.json"
    if not mcp_path.exists():
        return None
    try:
        with open(mcp_path) as f:
            mcp_config = json.load(f)
        if "notion" in mcp_config.get("mcpServers", {}):
            return {
                "id": "notion",
                "provider": "notion",
                "display_name": "Notion",
                "connected": True,
                "tables_count": 0,
                "category": "integration",
            }
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def list_providers() -> list[dict]:
    """Return the list of supported provider types with their field schemas."""
    result = []
    for provider_id, schema in PROVIDER_SCHEMAS.items():
        # Strip secret defaults — only include safe metadata
        fields_safe = []
        for f in schema["fields"]:
            fields_safe.append({
                "key": f["key"],
                "label": f["label"],
                "required": f["required"],
                "secret": f["secret"],
                "default": f.get("default"),
            })
        result.append({
            "id": provider_id,
            "display_name": schema["display_name"],
            "fields": fields_safe,
        })
    return result


def list_connections() -> list[dict]:
    """Return all saved connections (metadata only — no credentials)."""
    conns = _read_connections()
    result = []
    for conn_id, meta in conns.items():
        result.append({
            "id": conn_id,
            "provider": meta.get("provider", "unknown"),
            "display_name": meta.get("display_name", conn_id),
            "env_prefix": meta.get("env_prefix", ""),
        })
    # Append Notion integration if configured
    notion = _check_notion_status()
    if notion:
        result.append(notion)
    return result


def create_connection(
    connection_id: str,
    provider: str,
    display_name: str,
    credentials: dict[str, str],
) -> dict:
    """Create a new connection: store metadata in JSON, credentials in .env.

    Args:
        connection_id: Short identifier (alphanumeric + underscore).
        provider: One of the PROVIDER_SCHEMAS keys.
        display_name: Human-readable name.
        credentials: Dict of field_key -> value for this provider.

    Returns:
        dict with id, provider, display_name.

    Raises:
        ValueError: If provider is unknown or required fields are missing.
    """
    if provider not in PROVIDER_SCHEMAS:
        raise ValueError(f"Unknown provider: {provider}. Supported: {list(PROVIDER_SCHEMAS.keys())}")

    schema = PROVIDER_SCHEMAS[provider]
    missing = []
    for field in schema["fields"]:
        if field["required"] and not credentials.get(field["key"]):
            missing.append(field["key"])
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    env_prefix = f"CONN_{connection_id.upper()}"

    with _lock:
        # Write credentials to .env
        _ensure_env_file()
        for field in schema["fields"]:
            value = credentials.get(field["key"], field.get("default", ""))
            if value:
                set_key(str(ENV_FILE_PATH), _env_key(connection_id, field["key"]), value)

        # Write metadata to connections.json (never credential values)
        conns = _read_connections()
        conns[connection_id] = {
            "provider": provider,
            "display_name": display_name,
            "env_prefix": env_prefix,
        }
        _write_connections(conns)

    logger.info("Created connection %s (provider=%s)", connection_id, provider)
    return {
        "id": connection_id,
        "provider": provider,
        "display_name": display_name,
    }


def delete_connection(connection_id: str) -> bool:
    """Delete a connection: remove from JSON and unset .env variables.

    Returns True if the connection existed and was deleted.
    """
    with _lock:
        conns = _read_connections()
        if connection_id not in conns:
            return False

        meta = conns.pop(connection_id)
        _write_connections(conns)

        # Remove .env variables for this connection
        provider = meta.get("provider", "")
        schema = PROVIDER_SCHEMAS.get(provider, {"fields": []})
        _ensure_env_file()
        for field in schema["fields"]:
            try:
                unset_key(str(ENV_FILE_PATH), _env_key(connection_id, field["key"]))
            except Exception:
                pass

    logger.info("Deleted connection %s", connection_id)
    return True


def get_connection_manager(connection_id: str) -> ConnectionManager:
    """Build a ConnectionManager for the given connection_id.

    Reads metadata from connections.json, credentials from .env,
    and constructs a config dict matching ConnectionManager's expected shape.

    Raises:
        ValueError: If the connection_id is not found.
    """
    import os
    from dotenv import load_dotenv

    conns = _read_connections()
    if connection_id not in conns:
        raise ValueError(f"Connection not found: {connection_id}")

    meta = conns[connection_id]
    provider = meta["provider"]
    schema = PROVIDER_SCHEMAS.get(provider, {"fields": []})

    # Reload .env to pick up any recently written credentials
    load_dotenv(str(ENV_FILE_PATH), override=True)

    # Build the connection dict from env vars
    conn_dict: dict[str, Any] = {}
    for field in schema["fields"]:
        env_name = _env_key(connection_id, field["key"])
        value = os.environ.get(env_name, field.get("default", ""))
        conn_dict[field["key"]] = value

    # Handle port as integer for postgres
    if provider == "postgres" and conn_dict.get("port"):
        try:
            conn_dict["port"] = int(conn_dict["port"])
        except (ValueError, TypeError):
            conn_dict["port"] = 5432

    config = {
        "type": provider,
        "dataset_id": f"conn_{connection_id}",
        "display_name": meta.get("display_name", connection_id),
        "schema_prefix": conn_dict.get("schema", ""),
        "duckdb_path": None,
        "csv_path": None,
        "connection": conn_dict,
    }

    return ConnectionManager(config=config)


def test_connection(connection_id: str) -> dict:
    """Test a saved connection. Returns {ok, type, message}."""
    try:
        mgr = get_connection_manager(connection_id)
        result = mgr.test_connection()
        mgr.close()
        return result
    except Exception as exc:
        return {"ok": False, "type": "unknown", "message": str(exc)}
