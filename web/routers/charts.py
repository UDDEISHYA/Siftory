from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from web.config import CHART_OUTPUT_DIR

router = APIRouter(prefix="/api/charts", tags=["charts"])


@router.get("/{filename}")
def get_chart(filename: str):
    if ".." in filename or "/" in filename:
        raise HTTPException(400, "Invalid filename")

    path = CHART_OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(404, f"Chart not found: {filename}")

    return FileResponse(str(path), media_type="image/png")
