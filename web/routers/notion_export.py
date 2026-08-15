"""Router for Notion export endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from web.services import notion_export_service

router = APIRouter(prefix="/api/export/notion", tags=["notion-export"])


class ChartExportRequest(BaseModel):
    chart_filename: str
    title: str
    caption: str = ""
    sql: str = ""


class AnalysisExportRequest(BaseModel):
    question: str
    findings: list[dict] = []
    charts: list[dict] = []
    sql_queries: list[str] = []


class MarkExportedRequest(BaseModel):
    export_id: str
    notion_url: str


@router.post("/chart")
def export_chart(req: ChartExportRequest):
    result = notion_export_service.export_chart(
        chart_filename=req.chart_filename,
        title=req.title,
        caption=req.caption,
        sql=req.sql,
    )
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.post("/analysis")
def export_analysis(req: AnalysisExportRequest):
    result = notion_export_service.export_analysis(
        question=req.question,
        findings=req.findings,
        charts=req.charts,
        sql_queries=req.sql_queries,
    )
    return result


@router.get("/pending")
def list_pending():
    """Return exports saved locally but not yet pushed to Notion."""
    return {"pending": notion_export_service.get_pending_exports()}


@router.post("/mark-exported")
def mark_exported(req: MarkExportedRequest):
    """Mark a pending export as exported after MCP push."""
    ok = notion_export_service.mark_exported(req.export_id, req.notion_url)
    if not ok:
        raise HTTPException(status_code=404, detail="Export not found")
    return {"status": "marked", "export_id": req.export_id}


@router.get("/exports")
def list_exports():
    return {"exports": notion_export_service.list_exports()}
