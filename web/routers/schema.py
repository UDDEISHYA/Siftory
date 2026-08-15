from __future__ import annotations

from fastapi import APIRouter, HTTPException

from web.services import profiling_service

router = APIRouter(prefix="/api/datasets", tags=["schema"])


@router.get("/{table_name}/profile")
def profile_dataset(table_name: str, source: str = "upload"):
    cached = profiling_service.get_cached_profile(table_name, source)
    if cached:
        return cached
    result = profiling_service.profile_table(table_name, source)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.get("/{source}/profile-all")
def profile_all(source: str = "upload"):
    result = profiling_service.profile_all_tables(source)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result
