"""Router for the Master Analyzer multi-source chat."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from web.services import analysis_service

router = APIRouter(prefix="/api/analyzer", tags=["analyzer"])


class AnalyzerChatRequest(BaseModel):
    message: str
    sources: list[str] = ["upload"]
    session_id: str | None = None


@router.post("/chat")
def analyzer_chat(req: AnalyzerChatRequest):
    result = analysis_service.handle_analyzer_chat(
        message=req.message,
        sources=req.sources,
        session_id=req.session_id,
    )
    return result
