from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from web.config import UPLOAD_DIR, MAX_UPLOAD_SIZE_MB
from web.services import dataset_service

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.post("/upload")
async def upload_dataset(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported")

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_SIZE_MB:
        raise HTTPException(400, f"File exceeds {MAX_UPLOAD_SIZE_MB}MB limit")

    save_path = UPLOAD_DIR / file.filename
    save_path.write_bytes(content)

    try:
        result = dataset_service.ingest_csv(save_path, file.filename)
    except Exception as e:
        save_path.unlink(missing_ok=True)
        msg = str(e)
        if "csv" in msg.lower() or "delimiter" in msg.lower() or "parse" in msg.lower():
            detail = f"Could not parse CSV file. Check that it uses commas as delimiters and has a header row. Details: {msg}"
        elif "encoding" in msg.lower() or "utf" in msg.lower() or "codec" in msg.lower():
            detail = f"File encoding issue. Save the file as UTF-8 and try again. Details: {msg}"
        else:
            detail = f"Failed to process CSV: {msg}"
        raise HTTPException(400, detail)

    return {
        "table_name": result["table_name"],
        "row_count": result["row_count"],
        "columns": result["columns"],
        "status": "ok",
    }


@router.get("")
def list_datasets():
    return {"datasets": dataset_service.list_datasets()}


@router.get("/{table_name}")
def get_dataset(table_name: str, source: str = "upload"):
    info = dataset_service.get_dataset_info(table_name, source)
    if info is None:
        raise HTTPException(404, f"Dataset '{table_name}' not found")
    return info


@router.delete("/{table_name}")
def delete_dataset(table_name: str):
    deleted = dataset_service.delete_dataset(table_name)
    if not deleted:
        raise HTTPException(404, f"Dataset '{table_name}' not found or is a demo dataset")
    return {"status": "deleted", "table_name": table_name}
