from __future__ import annotations

import time
import uuid
from collections import defaultdict
from pathlib import Path

import yaml

from web.services import agent_executor, query_service, chart_service

BASE_DIR = Path(__file__).resolve().parent.parent.parent
REGISTRY_PATH = BASE_DIR / "agents" / "registry.yaml"

PIPELINE_PLANS = {
    "guided_analysis": [
        "question-framing",
        "data-explorer",
        "descriptive-analytics",
        "validation",
    ],
    "deep_investigation": [
        "question-framing",
        "hypothesis",
        "data-explorer",
        "descriptive-analytics",
        "root-cause-investigator",
        "cross-verification",
        "validation",
        "opportunity-sizer",
    ],
    "full_presentation": [
        "question-framing",
        "hypothesis",
        "data-explorer",
        "descriptive-analytics",
        "root-cause-investigator",
        "cross-verification",
        "validation",
        "opportunity-sizer",
        "story-architect",
        "narrative-coherence-reviewer",
        "chart-maker",
        "visual-design-critic",
        "storytelling",
        "deck-creator",
        "comms-drafter",
    ],
}

LEVEL_TO_PLAN = {
    3: "guided_analysis",
    4: "deep_investigation",
    5: "full_presentation",
}

PHASE_LABELS = {
    "question-framing": "Framing Question",
    "hypothesis": "Generating Hypotheses",
    "data-explorer": "Exploring Data",
    "descriptive-analytics": "Analyzing Patterns",
    "overtime-trend": "Analyzing Trends",
    "cohort-analysis": "Analyzing Cohorts",
    "root-cause-investigator": "Investigating Root Cause",
    "cross-verification": "Cross-Verifying",
    "validation": "Validating Findings",
    "opportunity-sizer": "Sizing Opportunity",
    "story-architect": "Designing Storyboard",
    "narrative-coherence-reviewer": "Reviewing Narrative",
    "chart-maker": "Creating Charts",
    "visual-design-critic": "Reviewing Design",
    "chart-maker-fixes": "Fixing Charts",
    "storytelling": "Writing Narrative",
    "deck-creator": "Building Deck",
    "visual-design-critic-slides": "Reviewing Slides",
    "close-the-loop": "Closing Loop",
    "comms-drafter": "Drafting Communications",
}


def load_registry() -> dict:
    with open(REGISTRY_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _build_agent_map(registry: dict) -> dict[str, dict]:
    return {a["name"]: a for a in registry.get("agents", [])}


def resolve_execution_order(plan_name: str) -> list[list[str]]:
    if plan_name not in PIPELINE_PLANS:
        plan_name = "guided_analysis"

    return [[agent] for agent in PIPELINE_PLANS[plan_name]]


_active_runs: dict[str, dict] = {}


def get_run(run_id: str) -> dict | None:
    return _active_runs.get(run_id)


def create_run(
    question: str,
    source: str,
    level: int,
    schema_context: str,
) -> str:
    run_id = uuid.uuid4().hex[:12]
    plan_name = LEVEL_TO_PLAN.get(level, "guided_analysis")
    tiers = resolve_execution_order(plan_name)
    flat_agents = [a for tier in tiers for a in tier]

    _active_runs[run_id] = {
        "run_id": run_id,
        "question": question,
        "source": source,
        "level": level,
        "plan": plan_name,
        "tiers": tiers,
        "agents": flat_agents,
        "status": "pending",
        "started_at": None,
        "events": [],
        "results": {},
        "findings": [],
        "charts": [],
        "current_agent": None,
        "completed_agents": [],
        "schema_context": schema_context,
    }
    return run_id


def _emit(run: dict, event_type: str, data: dict):
    event = {"type": event_type, "timestamp": time.time(), **data}
    run["events"].append(event)


def _build_variables(run: dict) -> dict:
    results = run["results"]

    all_findings_text = ""
    for agent_name, result in results.items():
        if result.get("findings"):
            for f in result["findings"]:
                all_findings_text += f"- **{f.get('headline', '')}**: {f.get('evidence', '')} (confidence: {f.get('confidence', 'medium')})\n"
        if result.get("text"):
            all_findings_text += f"\n### {agent_name} summary\n{result['text']}\n"

    return {
        "BUSINESS_CONTEXT": run["question"],
        "PRODUCT_DESCRIPTION": "Product under analysis (see data schema for details)",
        "AVAILABLE_DATA": run["schema_context"],
        "DATA_SOURCE": f"DuckDB ({run['source']})",
        "ANALYSIS_GOALS": run["question"],
        "DATASET": run["source"],
        "DATASET_NAME": run["source"],
        "QUESTION_BRIEF": results.get("question-framing", {}).get("text", run["question"]),
        "HYPOTHESIS_DOC": results.get("hypothesis", {}).get("text", ""),
        "DATA_INVENTORY": results.get("data-explorer", {}).get("text", ""),
        "FOCUS_AREA": "all",
        "METRIC": "",
        "OBSERVATION": "",
        "DIMENSIONS": "",
        "ANALYSIS_RESULTS": all_findings_text,
        "KNOWN_CONTEXT": "",
        "QUERY_LOG": "",
        "CONNECTION_TYPE": "duckdb",
        "ANALYSIS_CODE": "",
        "VALIDATION_SCOPE": "full",
        "OPPORTUNITY": run["question"],
        "ASSUMPTIONS": "",
        "VALUE_METRICS": "",
        "OPPORTUNITY_SLUG": "web_analysis",
        "STORYBOARD": results.get("story-architect", {}).get("text", ""),
        "CHART_FILES": ", ".join(run["charts"]) if run["charts"] else "none",
        "NARRATIVE": results.get("storytelling", {}).get("text", ""),
        "CHARTS": ", ".join(run["charts"]) if run["charts"] else "none",
        "THEME": "analytics",
        "FORMAT": "marp",
        "CONTEXT": "stakeholder readout",
        "AUDIENCE": "senior stakeholders",
        "DECK_TITLE": f"Analysis: {run['question'][:60]}",
        "DECK_FILE": "",
        "TONE": "professional",
        "RECOMMENDATIONS": all_findings_text,
        "FINDINGS": all_findings_text,
        "CONFIDENCE_GRADE": "B",
        "EXPORT_FORMAT": "web",
        "DATE": time.strftime("%Y-%m-%d"),
    }


def _make_tool_executor(source: str):
    def executor(tool_name: str, tool_input: dict) -> dict:
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
    return executor


def execute_pipeline(run_id: str):
    run = _active_runs.get(run_id)
    if not run:
        return

    run["status"] = "running"
    run["started_at"] = time.time()
    _emit(run, "pipeline_start", {
        "plan": run["plan"],
        "agents": run["agents"],
        "question": run["question"],
    })

    tool_executor = _make_tool_executor(run["source"])

    for tier in run["tiers"]:
        for agent_name in tier:
            run["current_agent"] = agent_name
            label = PHASE_LABELS.get(agent_name, agent_name)

            _emit(run, "phase_start", {
                "agent": agent_name,
                "label": label,
            })

            variables = _build_variables(run)

            try:
                result = agent_executor.execute_agent(
                    agent_name=agent_name,
                    variables=variables,
                    schema_context=run["schema_context"],
                    tool_executor=tool_executor,
                )
            except Exception as e:
                result = {
                    "agent": agent_name,
                    "status": "error",
                    "error": str(e),
                    "findings": [],
                    "charts": [],
                    "tool_results": [],
                    "text": "",
                }

            run["results"][agent_name] = result
            run["completed_agents"].append(agent_name)

            if result.get("findings"):
                for finding in result["findings"]:
                    run["findings"].append({**finding, "agent": agent_name})
                    _emit(run, "finding", {
                        "agent": agent_name,
                        "headline": finding.get("headline", ""),
                        "confidence": finding.get("confidence", "medium"),
                        "evidence": finding.get("evidence", ""),
                    })

            if result.get("charts"):
                run["charts"].extend(result["charts"])
                for chart_file in result["charts"]:
                    _emit(run, "chart", {
                        "agent": agent_name,
                        "filename": chart_file,
                    })

            _emit(run, "phase_complete", {
                "agent": agent_name,
                "label": label,
                "status": result.get("status", "complete"),
                "elapsed": result.get("elapsed_seconds", 0),
                "findings_count": len(result.get("findings", [])),
            })

            if result.get("status") == "error":
                registry = load_registry()
                agent_map = _build_agent_map(registry)
                agent_def = agent_map.get(agent_name, {})
                is_critical = agent_def.get("critical", True)
                if is_critical:
                    _emit(run, "pipeline_error", {
                        "agent": agent_name,
                        "error": result.get("error", "Unknown error"),
                    })
                    run["status"] = "error"
                    run["current_agent"] = None
                    return

    run["status"] = "complete"
    run["current_agent"] = None
    elapsed_total = round(time.time() - run["started_at"], 1)

    _emit(run, "pipeline_complete", {
        "elapsed": elapsed_total,
        "findings_count": len(run["findings"]),
        "charts_count": len(run["charts"]),
        "agents_completed": len(run["completed_agents"]),
    })
