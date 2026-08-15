from __future__ import annotations

import asyncio
import json
import time

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from web.services import pipeline_orchestrator, query_service

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


class PipelineRequest(BaseModel):
    question: str
    source: str = "novamart_demo"
    level: int = 3


class PipelineResponse(BaseModel):
    run_id: str
    plan: str
    agents: list[str]
    status: str


@router.get("/runs")
async def list_runs():
    """List all pipeline runs (active and completed)."""
    runs = []
    for run_id, run in pipeline_orchestrator._active_runs.items():
        runs.append({
            "run_id": run_id,
            "question": run["question"],
            "status": run["status"],
            "agents": run["agents"],
            "completed_agents": run["completed_agents"],
            "findings_count": len(run["findings"]),
            "charts_count": len(run["charts"]),
        })
    return {"runs": runs}


@router.post("/start", response_model=PipelineResponse)
async def start_pipeline(req: PipelineRequest, background_tasks: BackgroundTasks):
    if req.level < 3 or req.level > 5:
        raise HTTPException(400, "Pipeline level must be 3, 4, or 5. Use /api/chat for L1-L2.")

    schema_context = query_service.get_schema_context(req.source)
    run_id = pipeline_orchestrator.create_run(
        question=req.question,
        source=req.source,
        level=req.level,
        schema_context=schema_context,
    )

    run = pipeline_orchestrator.get_run(run_id)

    background_tasks.add_task(pipeline_orchestrator.execute_pipeline, run_id)

    return PipelineResponse(
        run_id=run_id,
        plan=run["plan"],
        agents=run["agents"],
        status="started",
    )


@router.get("/{run_id}/events")
async def stream_events(run_id: str):
    run = pipeline_orchestrator.get_run(run_id)
    if not run:
        raise HTTPException(404, f"Run {run_id} not found")

    async def event_stream():
        last_idx = 0
        while True:
            events = run["events"]
            while last_idx < len(events):
                event = events[last_idx]
                data = json.dumps(event, default=str)
                yield f"event: {event['type']}\ndata: {data}\n\n"
                last_idx += 1

                if event["type"] in ("pipeline_complete", "pipeline_error"):
                    return

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{run_id}/status")
async def get_status(run_id: str):
    run = pipeline_orchestrator.get_run(run_id)
    if not run:
        raise HTTPException(404, f"Run {run_id} not found")

    return {
        "run_id": run_id,
        "status": run["status"],
        "plan": run["plan"],
        "current_agent": run["current_agent"],
        "completed_agents": run["completed_agents"],
        "agents": run["agents"],
        "findings_count": len(run["findings"]),
        "charts_count": len(run["charts"]),
    }


@router.get("/{run_id}/results")
async def get_results(run_id: str):
    run = pipeline_orchestrator.get_run(run_id)
    if not run:
        raise HTTPException(404, f"Run {run_id} not found")

    return {
        "run_id": run_id,
        "status": run["status"],
        "findings": run["findings"],
        "charts": run["charts"],
        "agent_summaries": {
            name: {
                "status": r.get("status"),
                "text": r.get("text", "")[:500],
                "findings_count": len(r.get("findings", [])),
                "charts": r.get("charts", []),
            }
            for name, r in run["results"].items()
        },
    }
