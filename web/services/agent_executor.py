from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
AGENTS_DIR = BASE_DIR / "agents"

_anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
_openai_key = os.environ.get("OPENAI_API_KEY", "")


def _detect_provider() -> str | None:
    if _anthropic_key:
        return "anthropic"
    if _openai_key:
        return "openai"
    return None


def load_agent_template(agent_name: str) -> str | None:
    path = AGENTS_DIR / f"{agent_name}.md"
    if not path.exists():
        for entry in AGENTS_DIR.iterdir():
            if entry.stem == agent_name and entry.suffix == ".md":
                path = entry
                break
        else:
            return None
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"<!--\s*CONTRACT_START.*?CONTRACT_END\s*-->", "", text, flags=re.DOTALL)
    return text.strip()


def substitute_variables(template: str, variables: dict) -> str:
    result = template
    for key, value in variables.items():
        placeholder = "{{" + key + "}}"
        result = result.replace(placeholder, str(value))
    return result


_AGENT_TOOLS = [
    {
        "name": "execute_sql",
        "description": (
            "Execute a read-only SQL query against the active DuckDB dataset. "
            "Only SELECT and WITH (CTE) statements allowed. Returns columns, rows, "
            "row_count, execution_ms. Use DuckDB SQL dialect. "
            "IMPORTANT: If the query returns 0 rows, your date/filter range is likely wrong — "
            "run a recon query (SELECT MIN/MAX of the date column) first to discover the "
            "actual data range, then retry with correct values. "
            "NEVER use CURRENT_DATE or NOW() for historical datasets."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "The SQL query to execute",
                },
            },
            "required": ["sql"],
        },
    },
    {
        "name": "generate_chart",
        "description": (
            "Generate a chart from data. Provide data as column arrays, "
            "chart type, x/y columns, and a title. Returns the chart filename."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "line", "grouped_bar"],
                },
                "data": {
                    "type": "object",
                    "description": "Data as {column_name: [values...]}",
                },
                "x_col": {"type": "string"},
                "y_col": {"type": "string"},
                "title": {"type": "string"},
                "highlight": {"type": "string"},
                "group_col": {"type": "string"},
            },
            "required": ["chart_type", "data", "x_col", "y_col"],
        },
    },
    {
        "name": "write_finding",
        "description": (
            "Record a key finding from the analysis. Each finding should have a "
            "headline, evidence, and confidence level."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "headline": {
                    "type": "string",
                    "description": "One-line insight (action-oriented)",
                },
                "evidence": {
                    "type": "string",
                    "description": "Supporting data and reasoning",
                },
                "confidence": {
                    "type": "string",
                    "enum": ["high", "medium", "low"],
                },
                "tables_used": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Tables referenced for this finding",
                },
            },
            "required": ["headline", "evidence", "confidence"],
        },
    },
]


def _anthropic_tools():
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["parameters"],
        }
        for t in _AGENT_TOOLS
    ]


def _openai_tools():
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"],
            },
        }
        for t in _AGENT_TOOLS
    ]


def execute_agent(
    agent_name: str,
    variables: dict,
    schema_context: str,
    tool_executor: callable,
    progress_callback: callable | None = None,
) -> dict:
    template = load_agent_template(agent_name)
    if template is None:
        return {
            "agent": agent_name,
            "status": "error",
            "error": f"Agent template not found: {agent_name}",
            "findings": [],
            "charts": [],
            "tool_results": [],
            "text": "",
        }

    prompt = substitute_variables(template, variables)

    system_prompt = (
        f"You are an AI data analyst agent executing the '{agent_name}' step of an analytical pipeline.\n\n"
        f"## Your Task\n{prompt}\n\n"
        f"## Available Data\n{schema_context}\n\n"
        "## CRITICAL: Data-First Methodology (ALWAYS follow this order)\n\n"
        "### Step 1 — Reconnaissance (MANDATORY before any filtered query)\n"
        "Before writing ANY query that filters by date, category, or status, you MUST\n"
        "first discover what values actually exist in the data. Run a quick recon query:\n\n"
        "- For DATE filters: `SELECT MIN(date_col), MAX(date_col) FROM table`\n"
        "- For CATEGORY filters: `SELECT DISTINCT category_col, COUNT(*) FROM table GROUP BY 1 ORDER BY 2 DESC LIMIT 20`\n"
        "- For \"last week/month\" questions: first find the MAX date, then calculate\n"
        "  the period relative to the data's actual latest date — NEVER use\n"
        "  CURRENT_DATE or NOW() because the data may be historical.\n\n"
        "**NEVER guess dates.** The schema above shows date ranges (⏱ markers). Use\n"
        "those as reference, but always confirm with a recon query.\n\n"
        "### Step 2 — Recovery (when a query fails)\n"
        "If a SQL query returns an error:\n"
        "1. Read the error message carefully.\n"
        "2. Fix the specific issue (missing GROUP BY, wrong column name, syntax error).\n"
        "3. Re-run the corrected query.\n"
        "4. NEVER give up after one error — always attempt to fix and retry.\n\n"
        "### Step 3 — Zero-Row Check\n"
        "If a query returns 0 rows, your filter is likely wrong. Run a recon query\n"
        "to find the actual date range or valid values, then re-run with correct filters.\n\n"
        "## Instructions\n"
        "1. Execute the analytical workflow described in your task.\n"
        "2. Use execute_sql to query data. Use DuckDB SQL dialect.\n"
        "3. Table and column names are case-sensitive — use them EXACTLY as shown in the schema.\n"
        "4. Use generate_chart for visualizations with action-oriented titles.\n"
        "5. Use write_finding for each key insight you discover.\n"
        "6. When the user says \"last week\" or \"recently\", interpret relative to the\n"
        "   latest date in the data, NOT today's date.\n"
        "7. Be thorough but concise. Focus on actionable findings.\n"
        "8. At the end, provide a summary of what you found.\n"
    )

    start = time.time()
    if progress_callback:
        progress_callback("agent_start", {"agent": agent_name})

    provider = _detect_provider()
    if provider == "anthropic":
        result = _execute_anthropic(system_prompt, tool_executor)
    elif provider == "openai":
        result = _execute_openai(system_prompt, tool_executor)
    else:
        result = {
            "status": "error",
            "error": "No LLM API key configured",
            "findings": [],
            "charts": [],
            "tool_results": [],
            "text": "",
        }

    elapsed = round(time.time() - start, 1)
    result["agent"] = agent_name
    result["elapsed_seconds"] = elapsed

    if progress_callback:
        progress_callback("agent_complete", {
            "agent": agent_name,
            "elapsed": elapsed,
            "findings_count": len(result.get("findings", [])),
            "charts_count": len(result.get("charts", [])),
            "status": result.get("status", "complete"),
        })

    return result


def _execute_anthropic(system_prompt: str, tool_executor: callable) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=_anthropic_key)

    findings = []
    charts = []
    tool_results = []
    messages = [{"role": "user", "content": "Execute the analytical workflow described in your system prompt. Begin your analysis now."}]

    for _ in range(15):
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            tools=_anthropic_tools(),
            messages=messages,
        )

        if response.stop_reason == "tool_use":
            assistant_content = response.content
            messages.append({"role": "assistant", "content": assistant_content})

            tool_use_results = []
            for block in assistant_content:
                if block.type == "tool_use":
                    if block.name == "write_finding":
                        findings.append(block.input)
                        result = {"status": "recorded"}
                    else:
                        result = tool_executor(block.name, block.input)

                    tool_results.append({
                        "tool": block.name,
                        "input": block.input,
                        "result": result,
                    })

                    if block.name == "generate_chart" and not result.get("error"):
                        charts.append(result.get("filename"))

                    tool_use_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result, default=str),
                    })

            messages.append({"role": "user", "content": tool_use_results})
            continue

        text_parts = [b.text for b in response.content if hasattr(b, "text")]
        final_text = "\n".join(text_parts)

        return {
            "status": "complete",
            "findings": findings,
            "charts": charts,
            "tool_results": tool_results,
            "text": final_text,
        }

    return {
        "status": "timeout",
        "findings": findings,
        "charts": charts,
        "tool_results": tool_results,
        "text": "Agent exceeded maximum iterations.",
    }


def _execute_openai(system_prompt: str, tool_executor: callable) -> dict:
    from openai import OpenAI
    client = OpenAI(api_key=_openai_key)

    findings = []
    charts = []
    tool_results = []
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Execute the analytical workflow described in your system prompt. Begin your analysis now."},
    ]

    for _ in range(15):
        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=messages,
            tools=_openai_tools(),
            tool_choice="auto",
        )

        choice = response.choices[0]

        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            messages.append(choice.message)

            for tc in choice.message.tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)

                if fn_name == "write_finding":
                    findings.append(fn_args)
                    result = {"status": "recorded"}
                else:
                    result = tool_executor(fn_name, fn_args)

                tool_results.append({
                    "tool": fn_name,
                    "input": fn_args,
                    "result": result,
                })

                if fn_name == "generate_chart" and not result.get("error"):
                    charts.append(result.get("filename"))

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, default=str),
                })
            continue

        final_text = choice.message.content or ""

        return {
            "status": "complete",
            "findings": findings,
            "charts": charts,
            "tool_results": tool_results,
            "text": final_text,
        }

    return {
        "status": "timeout",
        "findings": findings,
        "charts": charts,
        "tool_results": tool_results,
        "text": "Agent exceeded maximum iterations.",
    }
