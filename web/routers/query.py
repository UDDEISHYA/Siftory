from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from web.services import query_service, analysis_service, pipeline_orchestrator

router = APIRouter(prefix="/api", tags=["query"])


class SQLRequest(BaseModel):
    sql: str
    source: str = "upload"


class ChatRequest(BaseModel):
    message: str
    source: str = "upload"
    session_id: str | None = None


@router.post("/query")
def run_query(req: SQLRequest):
    result = query_service.execute_sql(req.sql, req.source)
    if result.get("error"):
        raise HTTPException(400, result.get("message", "Query failed"))
    return result


@router.post("/chat")
def chat(req: ChatRequest, background_tasks: BackgroundTasks):
    result = analysis_service.handle_chat(
        message=req.message,
        source=req.source,
        session_id=req.session_id,
    )

    if result.get("pipeline"):
        run_id = result["run_id"]
        background_tasks.add_task(pipeline_orchestrator.execute_pipeline, run_id)

    return result
