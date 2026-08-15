"""
Models router — manage LLM provider configuration.

Endpoints:
    GET  /api/models/status   → active provider + configured flags
    POST /api/models/active   → set active LLM provider
    POST /api/models/key      → save an API key for a provider
"""
from __future__ import annotations

import os

from dotenv import load_dotenv, set_key
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from web.config import ENV_FILE_PATH
from web.services import llm_service

router = APIRouter(prefix="/api/models", tags=["models"])

# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class ActiveProviderRequest(BaseModel):
    provider: str


class ApiKeyRequest(BaseModel):
    provider: str
    api_key: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status")
def get_status():
    """Return the active provider and whether each provider has a key configured."""
    # Re-read .env to pick up any external changes
    load_dotenv(str(ENV_FILE_PATH), override=True)

    active = llm_service.get_active_provider()
    anthropic_configured = bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())
    openai_configured = bool(os.environ.get("OPENAI_API_KEY", "").strip())

    return {
        "active_provider": active or ("anthropic" if anthropic_configured else "openai" if openai_configured else "anthropic"),
        "anthropic_configured": anthropic_configured,
        "openai_configured": openai_configured,
    }


@router.post("/active")
def set_active(req: ActiveProviderRequest):
    """Set the active LLM provider."""
    provider = req.provider.strip().lower()
    if provider not in ("anthropic", "openai"):
        raise HTTPException(400, "Provider must be 'anthropic' or 'openai'")

    set_key(str(ENV_FILE_PATH), "ACTIVE_LLM_PROVIDER", provider)
    os.environ["ACTIVE_LLM_PROVIDER"] = provider
    llm_service.set_active_provider(provider)

    return {"status": "ok", "active_provider": provider}


@router.post("/key")
def save_key(req: ApiKeyRequest):
    """Save an API key for a provider to .env and reload in memory."""
    provider = req.provider.strip().lower()
    if provider not in ("anthropic", "openai"):
        raise HTTPException(400, "Provider must be 'anthropic' or 'openai'")

    key = req.api_key.strip()
    if not key:
        raise HTTPException(400, "API key cannot be empty")

    env_var = "ANTHROPIC_API_KEY" if provider == "anthropic" else "OPENAI_API_KEY"
    set_key(str(ENV_FILE_PATH), env_var, key)
    os.environ[env_var] = key

    # Reload keys in the LLM service so they take effect immediately
    llm_service.reload_keys()

    return {"status": "ok", "provider": provider}
