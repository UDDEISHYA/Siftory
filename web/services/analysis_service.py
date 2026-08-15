from __future__ import annotations

import json
import re
import uuid

from web.services import llm_service, query_service, chart_service


def classify_question(message: str) -> int:
    msg = message.lower().strip()

    l1_patterns = [
        r"^how many\b",
        r"^how much\b",
        r"^what is the (average|mean|median|total|count|sum|min|max)\b",
        r"^what('s| is) the .{0,20} (rate|count|total|number)\b",
        r"^count\b",
    ]
    for pat in l1_patterns:
        if re.search(pat, msg):
            return 1

    l2_patterns = [
        r"\bcompare\b",
        r"\bby (device|channel|category|segment|region|country|platform)\b",
        r"\bbreakdown\b",
        r"\bsplit\b",
        r"\btop \d+\b",
        r"\bshow me .{0,30} by\b",
        r"\btrend\b",
        r"\bover time\b",
    ]
    for pat in l2_patterns:
        if re.search(pat, msg):
            return 2

    l4_patterns = [
        r"\binvestigat\w*\b",
        r"\broot cause\b",
        r"\bwhy did .+ (drop|decline|fall|decrease|spike|jump|increase)\b",
        r"\bsize the opportunity\b",
        r"\bdesign .+ (experiment|test|a\/b)\b",
        r"\bwhat caused\b",
        r"\bwhat's driving\b",
        r"\bdiagnos\w*\b",
    ]
    for pat in l4_patterns:
        if re.search(pat, msg):
            return 4

    l5_patterns = [
        r"\bfull pipeline\b",
        r"\brun.pipeline\b",
        r"\bbuild .+ deck\b",
        r"\bpresentation\b",
        r"\bend.to.end\b",
        r"\bboard.ready\b",
    ]
    for pat in l5_patterns:
        if re.search(pat, msg):
            return 5

    l3_patterns = [
        r"\bwhy\b",
        r"\banalyze\b",
        r"\banalysis\b",
        r"\bwhich .+ (has|have|is|are) the (high|low|best|worst)\b",
        r"\bwhat (factor|driver|variable)\b",
        r"\bsegment\b",
        r"\bfunnel\b",
        r"\bcohort\b",
        r"\bretention\b",
    ]
    for pat in l3_patterns:
        if re.search(pat, msg):
            return 3

    return 2


def handle_chat(message: str, source: str, session_id: str | None = None) -> dict:
    if not session_id:
        session_id = uuid.uuid4().hex

    if not llm_service.is_configured():
        return {
            "session_id": session_id,
            "blocks": [{
                "type": "error",
                "content": (
                    "No LLM API key configured. Add one to your .env file:\n\n"
                    "  ANTHROPIC_API_KEY=sk-ant-...   (for Claude)\n"
                    "  OPENAI_API_KEY=sk-...          (for GPT)\n\n"
                    "Then restart the server."
                ),
            }],
        }

    level = classify_question(message)

    schema_context = query_service.get_schema_context(source)

    if level >= 3:
        from web.services import pipeline_orchestrator
        run_id = pipeline_orchestrator.create_run(
            question=message,
            source=source,
            level=level,
            schema_context=schema_context,
        )
        return {
            "session_id": session_id,
            "pipeline": True,
            "run_id": run_id,
            "level": level,
            "plan": pipeline_orchestrator.LEVEL_TO_PLAN.get(level, "guided_analysis"),
            "agents": pipeline_orchestrator.get_run(run_id)["agents"],
            "blocks": [{
                "type": "text",
                "content": (
                    f"This is an L{level} question — launching the "
                    f"**{pipeline_orchestrator.LEVEL_TO_PLAN.get(level, 'guided_analysis').replace('_', ' ').title()}** "
                    f"pipeline with {len(pipeline_orchestrator.get_run(run_id)['agents'])} agents. "
                    f"Watch the sidebar for real-time progress."
                ),
            }],
        }

    try:
        result = llm_service.chat(
            message=message,
            schema_context=schema_context,
            session_id=session_id,
            tool_executor=lambda name, inp: _execute_tool(name, inp, source),
            source=source,
        )
    except Exception as e:
        error_type = type(e).__name__
        if "auth" in str(e).lower() or "api key" in str(e).lower():
            detail = "API key is invalid or expired. Check your .env file and restart the server."
        elif "rate" in str(e).lower() or "limit" in str(e).lower():
            detail = "API rate limit reached. Wait a moment and try again."
        elif "timeout" in str(e).lower() or "connect" in str(e).lower():
            detail = "Could not reach the LLM API. Check your internet connection."
        else:
            detail = f"LLM request failed ({error_type}). Try again or simplify your question."
        return {
            "session_id": session_id,
            "blocks": [{"type": "error", "content": detail}],
        }

    blocks = _build_response_blocks(result)

    return {
        "session_id": session_id,
        "blocks": blocks,
    }


def handle_analyzer_chat(message: str, sources: list[str], session_id: str | None = None) -> dict:
    """Handle chat from the Master Analyzer with multi-source support."""
    if not session_id:
        session_id = uuid.uuid4().hex

    if not llm_service.is_configured():
        return {
            "session_id": session_id,
            "blocks": [{
                "type": "error",
                "content": (
                    "No LLM API key configured. Add one to your .env file:\n\n"
                    "  ANTHROPIC_API_KEY=sk-ant-...   (for Claude)\n"
                    "  OPENAI_API_KEY=sk-...          (for GPT)\n\n"
                    "Then restart the server."
                ),
            }],
        }

    # Build combined schema context from all sources
    schema_context = query_service.get_multi_schema_context(sources)

    # For multi-source, we need a tool executor that can dispatch to the right DB
    default_source = sources[0] if sources else "upload"

    def multi_tool_executor(name: str, inp: dict) -> dict:
        if name == "execute_sql":
            # Use the database field if provided, otherwise default
            target = inp.pop("database", default_source)
            return _execute_tool("execute_sql", inp, target)
        return _execute_tool(name, inp, default_source)

    try:
        if len(sources) > 1:
            result = llm_service.chat_multi(
                message=message,
                schemas_by_source=query_service.get_schemas_by_source(sources),
                session_id=f"analyzer_{session_id}",
                tool_executor=multi_tool_executor,
            )
        else:
            result = llm_service.chat(
                message=message,
                schema_context=schema_context,
                session_id=f"analyzer_{session_id}",
                tool_executor=lambda name, inp: _execute_tool(name, inp, default_source),
                source=default_source,
            )
    except Exception as e:
        error_type = type(e).__name__
        if "auth" in str(e).lower() or "api key" in str(e).lower():
            detail = "API key is invalid or expired. Check your .env file and restart the server."
        elif "rate" in str(e).lower() or "limit" in str(e).lower():
            detail = "API rate limit reached. Wait a moment and try again."
        else:
            detail = f"LLM request failed ({error_type}). Try again or simplify your question."
        return {"session_id": session_id, "blocks": [{"type": "error", "content": detail}]}

    blocks = _build_response_blocks(result)
    return {"session_id": session_id, "blocks": blocks}


def _execute_tool(tool_name: str, tool_input: dict, source: str) -> dict:
    if tool_name == "execute_sql":
        return query_service.execute_sql(tool_input["sql"], source)

    elif tool_name == "generate_chart":
        try:
            filename = chart_service.generate_chart_from_spec(
                chart_type=tool_input.get("chart_type", "bar"),
                data=tool_input["data"],
                x_col=tool_input["x_col"],
                y_col=tool_input["y_col"],
                title=tool_input.get("title"),
                highlight=tool_input.get("highlight"),
                group_col=tool_input.get("group_col"),
            )
            return {"error": False, "filename": filename}
        except Exception as e:
            return {"error": True, "message": str(e)}

    return {"error": True, "message": f"Unknown tool: {tool_name}"}


def _build_response_blocks(result: dict) -> list[dict]:
    blocks = []

    if result["response_type"] == "error":
        blocks.append({"type": "error", "content": result["content"]})
        return blocks

    # Process trace blocks (thinking + tool calls) — collapsed by default in UI
    for step in result.get("intermediate_steps", []):
        if step["type"] == "thinking":
            blocks.append({
                "type": "thinking",
                "step": step["step"],
                "content": step["content"],
            })
        elif step["type"] == "tool_call":
            blocks.append({
                "type": "tool_call",
                "step": step["step"],
                "tool": step["tool"],
                "input": step["input"],
                "result_summary": step["result_summary"],
                "has_error": step.get("has_error", False),
            })

    for tr in result.get("tool_results", []):
        if tr["tool"] == "execute_sql" and not tr["result"].get("error"):
            r = tr["result"]
            if r["row_count"] > 0:
                blocks.append({
                    "type": "table",
                    "columns": r["columns"],
                    "rows": r["rows"],
                    "row_count": r["row_count"],
                    "execution_ms": r["execution_ms"],
                    "sql": tr["input"].get("sql", ""),
                })

        elif tr["tool"] == "generate_chart" and not tr["result"].get("error"):
            blocks.append({
                "type": "chart",
                "filename": tr["result"]["filename"],
                "title": tr["input"].get("title", ""),
            })

    if result.get("content"):
        blocks.append({
            "type": "text",
            "content": result["content"],
        })

    return blocks
