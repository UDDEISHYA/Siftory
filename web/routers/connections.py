"""
Connections router — manage external database connections.

Endpoints:
    GET  /api/connections/providers          → list supported provider types
    GET  /api/connections                    → list saved connections
    POST /api/connections                    → create a new connection
    POST /api/connections/{id}/test          → test connectivity
    GET  /api/connections/{id}/tables        → list tables in a connection
    DELETE /api/connections/{id}             → delete a connection
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from web.services import connection_service

router = APIRouter(prefix="/api/connections", tags=["connections"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ConnectionCreateRequest(BaseModel):
    connection_id: str
    provider: str
    display_name: str
    credentials: dict[str, str]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/providers")
def list_providers():
    """Return the list of supported database providers with their field schemas."""
    return {"providers": connection_service.list_providers()}


@router.get("")
def list_connections():
    """Return all saved connections (metadata only, no credentials)."""
    return {"connections": connection_service.list_connections()}


@router.post("")
def create_connection(req: ConnectionCreateRequest):
    """Create a new external database connection."""
    # Validate connection_id format
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]{0,31}$", req.connection_id):
        raise HTTPException(
            400,
            "connection_id must start with a letter, contain only letters/digits/underscores, "
            "and be at most 32 characters.",
        )

    try:
        result = connection_service.create_connection(
            connection_id=req.connection_id,
            provider=req.provider,
            display_name=req.display_name,
            credentials=req.credentials,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    return {"status": "created", **result}


@router.post("/{connection_id}/test")
def test_connection(connection_id: str):
    """Test connectivity for a saved connection."""
    conns = connection_service.list_connections()
    if not any(c["id"] == connection_id for c in conns):
        raise HTTPException(404, f"Connection '{connection_id}' not found")

    result = connection_service.test_connection(connection_id)
    status_code = 200 if result["ok"] else 422
    return result


@router.get("/{connection_id}/detail")
def get_connection_detail(connection_id: str):
    """Return detailed info about a connection including health and table count."""
    conns = connection_service.list_connections()
    conn = next((c for c in conns if c["id"] == connection_id), None)
    if not conn:
        raise HTTPException(404, f"Connection '{connection_id}' not found")

    health = connection_service.test_connection(connection_id)
    tables = []
    if health["ok"]:
        try:
            mgr = connection_service.get_connection_manager(connection_id)
            mgr.connect()
            tables = mgr.list_tables()
            mgr.close()
        except Exception:
            pass

    return {
        "id": connection_id,
        "provider": conn.get("provider"),
        "display_name": conn.get("display_name"),
        "connected": health["ok"],
        "health_message": health.get("message", ""),
        "tables_count": len(tables),
        "tables": tables,
    }


@router.get("/{connection_id}/tables")
def list_tables(connection_id: str):
    """List tables available in a remote connection."""
    conns = connection_service.list_connections()
    if not any(c["id"] == connection_id for c in conns):
        raise HTTPException(404, f"Connection '{connection_id}' not found")

    try:
        mgr = connection_service.get_connection_manager(connection_id)
        mgr.connect()
        tables = mgr.list_tables()
        mgr.close()
        return {"connection_id": connection_id, "tables": tables}
    except Exception as exc:
        raise HTTPException(500, f"Failed to list tables: {exc}")


@router.delete("/{connection_id}")
def delete_connection(connection_id: str):
    """Delete a saved connection and its credentials."""
    deleted = connection_service.delete_connection(connection_id)
    if not deleted:
        raise HTTPException(404, f"Connection '{connection_id}' not found")
    return {"status": "deleted", "connection_id": connection_id}
