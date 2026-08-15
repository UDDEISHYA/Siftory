from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

_anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
_openai_key = os.environ.get("OPENAI_API_KEY", "")


def reload_keys():
    """Re-read .env to pick up new API keys."""
    global _anthropic_key, _openai_key
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env", override=True)
    _anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    _openai_key = os.environ.get("OPENAI_API_KEY", "")


def get_active_provider() -> str | None:
    """Return the explicitly configured provider, or auto-detect."""
    active = os.environ.get("ACTIVE_LLM_PROVIDER", "").strip().lower()
    if active in ("anthropic", "openai"):
        return active
    return _detect_provider()


def set_active_provider(provider: str):
    """Set the active provider in .env."""
    from dotenv import set_key as _set_key
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    _set_key(str(env_path), "ACTIVE_LLM_PROVIDER", provider)
    os.environ["ACTIVE_LLM_PROVIDER"] = provider

# ── Tool definitions (provider-neutral shape, converted at call time) ──

_TOOLS_CORE = [
    {
        "name": "execute_sql",
        "description": (
            "Execute a read-only SQL query against the active DuckDB dataset. "
            "Only SELECT and WITH (CTE) statements are allowed. "
            "Returns columns, rows (max 1000), row_count, and execution_ms. "
            "Use DuckDB SQL dialect. "
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
                    "description": "The SQL query to execute (SELECT or WITH only)",
                },
            },
            "required": ["sql"],
        },
    },
    {
        "name": "generate_chart",
        "description": (
            "Generate a chart from query results. Provide the data as column arrays, "
            "specify chart type (bar, line, grouped_bar), x/y columns, and a title. "
            "Returns the chart filename which can be served at /api/charts/{filename}."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "line", "grouped_bar"],
                    "description": "Type of chart to generate",
                },
                "data": {
                    "type": "object",
                    "description": "Data as {column_name: [values...]} dict",
                },
                "x_col": {"type": "string", "description": "Column name for x-axis"},
                "y_col": {"type": "string", "description": "Column name for y-axis"},
                "title": {"type": "string", "description": "Chart title (action-oriented headline)"},
                "highlight": {
                    "type": "string",
                    "description": "Category value to highlight (for bar charts)",
                },
                "group_col": {
                    "type": "string",
                    "description": "Grouping column (for grouped_bar only)",
                },
            },
            "required": ["chart_type", "data", "x_col", "y_col"],
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
        for t in _TOOLS_CORE
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
        for t in _TOOLS_CORE
    ]


# ── Session history ──

_sessions: dict[str, list[dict]] = {}
MAX_HISTORY = 20


# ── Provider detection ──

def _detect_provider() -> str | None:
    active = os.environ.get("ACTIVE_LLM_PROVIDER", "").strip().lower()
    if active == "anthropic" and _anthropic_key:
        return "anthropic"
    if active == "openai" and _openai_key:
        return "openai"
    if _anthropic_key:
        return "anthropic"
    if _openai_key:
        return "openai"
    return None


def is_configured() -> bool:
    return _detect_provider() is not None


def _provider_label() -> str:
    p = _detect_provider()
    if p == "anthropic":
        return "Claude"
    if p == "openai":
        return "GPT"
    return "LLM"


# ── SQL dialect detection ──

_DIALECT_INSTRUCTIONS = {
    "snowflake": "Use Snowflake SQL syntax. Functions like DATE_TRUNC, IFF, FLATTEN are available.",
    "databricks": "Use Databricks SQL (Spark SQL) syntax. Functions like DATE_TRUNC, IF, EXPLODE are available.",
    "postgres": "Use PostgreSQL syntax. Functions like DATE_TRUNC, COALESCE, EXTRACT are available.",
    "duckdb": "Use DuckDB SQL syntax. Table and column names are case-sensitive — use them exactly as shown in the schema.",
}


def _detect_sql_dialect(source: str) -> str:
    """Detect the SQL dialect from the source identifier."""
    if source.startswith("conn:"):
        connection_id = source[5:]
        try:
            from web.services import connection_service
            conns = connection_service.list_connections()
            for c in conns:
                if c["id"] == connection_id:
                    return c.get("provider", "duckdb")
        except Exception:
            pass
    return "duckdb"


# ── System prompt (shared) ──

def build_system_prompt(schema_context: str, source: str = "upload") -> str:
    dialect = _detect_sql_dialect(source)
    dialect_instruction = _DIALECT_INSTRUCTIONS.get(dialect, _DIALECT_INSTRUCTIONS["duckdb"])
    db_label = dialect.replace("_", " ").title() if dialect != "duckdb" else "DuckDB"

    return f"""You are Siftory, an AI data analyst working with a {db_label} database. Your job is to answer analytical questions about the data by writing and executing SQL queries, and optionally generating charts.

## Available Data
{schema_context}

## CRITICAL: Data-First Methodology (ALWAYS follow this order)

### Step 1 — Reconnaissance (MANDATORY before any filtered query)
Before writing ANY query that filters by date, category, or status, you MUST
first discover what values actually exist in the data. Run a quick recon query:

- For DATE filters: `SELECT MIN(date_col), MAX(date_col) FROM table`
- For CATEGORY filters: `SELECT DISTINCT category_col, COUNT(*) FROM table GROUP BY 1 ORDER BY 2 DESC LIMIT 20`
- For "last week/month" questions: first find the MAX date, then calculate
  the period relative to the data's actual latest date — NEVER use
  CURRENT_DATE or NOW() because the data may be historical.

**NEVER guess dates.** The schema above shows date ranges (⏱ markers). Use
those as reference, but always confirm with a recon query for the specific
table you're analyzing.

### Step 2 — Analysis
Once you know the actual data bounds, write your analytical queries using the
real values from Step 1.

### Step 3 — Recovery (when a query fails)
If a SQL query returns an error:
1. Read the error message carefully.
2. Fix the specific issue (missing GROUP BY, wrong column name, syntax error).
3. Re-run the corrected query.
4. NEVER give up after one error — always attempt to fix and retry.

Common fixes:
- "Binder Error: column X must appear in GROUP BY" → add the column to GROUP BY
- "column does not exist" → check the exact column names from the schema above
- 0 rows returned → your date range is wrong; run a recon query to find the actual range

## Instructions
1. {dialect_instruction}
2. When the user asks a question about data, FIRST run a recon query to
   understand the data's actual time range and available values, THEN write
   your analytical query.
3. After getting query results, provide a clear, concise answer explaining
   what the data shows.
4. When a visual would help (comparisons, trends, distributions), use
   generate_chart to create a chart.
5. For chart titles, use action-oriented headlines that state the key finding
   (e.g., "Mobile drives 60% of traffic" not "Traffic by device").
6. Always cite specific numbers from the results.
7. If the data cannot answer the question, say so clearly.
8. When the user says "last week" or "recently", interpret that relative to
   the latest date in the data, NOT today's date.
9. Table and column names in DuckDB are case-sensitive — use them EXACTLY as
   shown in the schema.

## Response Format
After executing queries and/or generating charts, provide your analysis as plain text. Be concise — lead with the key finding, then supporting details."""


# ── Main chat function ──

def chat(
    message: str,
    schema_context: str,
    session_id: str,
    tool_executor: callable,
    source: str = "upload",
) -> dict:
    provider = _detect_provider()
    if provider is None:
        return {
            "response_type": "error",
            "content": (
                "No LLM API key configured. Add one to your .env file:\n\n"
                "  ANTHROPIC_API_KEY=sk-ant-...   (for Claude)\n"
                "  OPENAI_API_KEY=sk-...          (for GPT)\n\n"
                "Then restart the server."
            ),
            "tool_results": [],
        }

    if session_id not in _sessions:
        _sessions[session_id] = []

    history = _sessions[session_id]
    history.append({"role": "user", "content": message})

    if len(history) > MAX_HISTORY * 2:
        history[:] = history[-(MAX_HISTORY * 2):]

    if provider == "anthropic":
        return _chat_anthropic(history, schema_context, session_id, tool_executor, source=source)
    else:
        return _chat_openai(history, schema_context, session_id, tool_executor, source=source)


# ── Anthropic (Claude) implementation ──

def _chat_anthropic(
    history: list, schema_context: str, session_id: str, tool_executor: callable,
    source: str = "upload",
) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=_anthropic_key)
    system_prompt = build_system_prompt(schema_context, source=source)
    tool_results = []
    charts = []
    intermediate_steps = []
    step_number = 0
    messages = list(history)

    for _ in range(10):
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

            # Capture thinking text between tool calls
            for block in assistant_content:
                if hasattr(block, "text") and block.text.strip():
                    step_number += 1
                    intermediate_steps.append({
                        "type": "thinking",
                        "step": step_number,
                        "content": block.text,
                    })

            tool_use_results = []
            for block in assistant_content:
                if block.type == "tool_use":
                    result = tool_executor(block.name, block.input)
                    tool_results.append({
                        "tool": block.name,
                        "input": block.input,
                        "result": result,
                    })

                    step_number += 1
                    intermediate_steps.append({
                        "type": "tool_call",
                        "step": step_number,
                        "tool": block.name,
                        "input": block.input,
                        "result_summary": _summarize_result(result),
                        "has_error": result.get("error", False),
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
        history.append({"role": "assistant", "content": final_text})

        return {
            "response_type": "analysis",
            "content": final_text,
            "tool_results": tool_results,
            "charts": charts,
            "intermediate_steps": intermediate_steps,
        }

    return _timeout_result(tool_results, charts, intermediate_steps)


# ── OpenAI (GPT) implementation ──

def _chat_openai(
    history: list, schema_context: str, session_id: str, tool_executor: callable,
    source: str = "upload",
) -> dict:
    from openai import OpenAI
    client = OpenAI(api_key=_openai_key)
    system_prompt = build_system_prompt(schema_context, source=source)
    tool_results = []
    charts = []
    intermediate_steps = []
    step_number = 0

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    for _ in range(10):
        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=messages,
            tools=_openai_tools(),
            tool_choice="auto",
        )

        choice = response.choices[0]

        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            # Capture any thinking text alongside tool calls
            if choice.message.content and choice.message.content.strip():
                step_number += 1
                intermediate_steps.append({
                    "type": "thinking",
                    "step": step_number,
                    "content": choice.message.content,
                })

            messages.append(choice.message)

            for tc in choice.message.tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)

                result = tool_executor(fn_name, fn_args)
                tool_results.append({
                    "tool": fn_name,
                    "input": fn_args,
                    "result": result,
                })

                step_number += 1
                intermediate_steps.append({
                    "type": "tool_call",
                    "step": step_number,
                    "tool": fn_name,
                    "input": fn_args,
                    "result_summary": _summarize_result(result),
                    "has_error": result.get("error", False),
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
        history.append({"role": "assistant", "content": final_text})

        return {
            "response_type": "analysis",
            "content": final_text,
            "tool_results": tool_results,
            "charts": charts,
            "intermediate_steps": intermediate_steps,
        }

    return _timeout_result(tool_results, charts, intermediate_steps)


# ── Multi-database support ──

def _tools_multi_core(source_ids: list[str]):
    """Tool definitions with database selector for multi-source mode."""
    tools = [
        {
            "name": "execute_sql",
            "description": (
                "Execute a read-only SQL query against one of the connected databases. "
                "Specify which database using the 'database' parameter. "
                "Only SELECT and WITH (CTE) statements are allowed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "The SQL query to execute (SELECT or WITH only)",
                    },
                    "database": {
                        "type": "string",
                        "enum": source_ids,
                        "description": "Which database to execute the query against",
                    },
                },
                "required": ["sql", "database"],
            },
        },
        _TOOLS_CORE[1],  # generate_chart stays the same
    ]
    return tools


def _anthropic_tools_multi(source_ids: list[str]):
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["parameters"],
        }
        for t in _tools_multi_core(source_ids)
    ]


def _openai_tools_multi(source_ids: list[str]):
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"],
            },
        }
        for t in _tools_multi_core(source_ids)
    ]


def build_multi_db_system_prompt(schema_context: str, source_ids: list[str]) -> str:
    source_list = ", ".join(source_ids)
    return f"""You are Siftory, an AI data analyst working with multiple databases. Your job is to answer analytical questions by writing and executing SQL queries across one or more databases.

## Available Databases
{schema_context}

## CRITICAL: Data-First Methodology (ALWAYS follow this order)

### Step 1 — Reconnaissance (MANDATORY before any filtered query)
Before writing ANY query that filters by date, category, or status, you MUST
first discover what values actually exist in the data. Run a quick recon query:

- For DATE filters: `SELECT MIN(date_col), MAX(date_col) FROM table`
- For CATEGORY filters: `SELECT DISTINCT category_col, COUNT(*) FROM table GROUP BY 1 ORDER BY 2 DESC LIMIT 20`
- For "last week/month" questions: first find the MAX date, then calculate
  the period relative to the data's actual latest date — NEVER use
  CURRENT_DATE or NOW() because the data may be historical.

**NEVER guess dates.** The schema above shows date ranges (⏱ markers). Use
those as reference, but always confirm with a recon query for the specific
table you're analyzing.

### Step 2 — Analysis
Once you know the actual data bounds, write your analytical queries using the
real values from Step 1.

### Step 3 — Recovery (when a query fails)
If a SQL query returns an error:
1. Read the error message carefully.
2. Fix the specific issue (missing GROUP BY, wrong column name, syntax error).
3. Re-run the corrected query.
4. NEVER give up after one error — always attempt to fix and retry.

Common fixes:
- "Binder Error: column X must appear in GROUP BY" → add the column to GROUP BY
- "column does not exist" → check the exact column names from the schema above
- 0 rows returned → your date range is wrong; run a recon query to find the actual range

## Instructions
1. When querying, specify which database to use via the "database" parameter in the execute_sql tool.
2. Available databases: {source_list}
3. Each database may use a different SQL dialect — check the database type in the schema above.
4. When the user asks a question about data, FIRST run a recon query to
   understand the data's actual time range and available values, THEN write
   your analytical query.
5. After getting query results, provide a clear analysis explaining what the data shows.
6. When a visual would help, use generate_chart to create a chart.
7. For chart titles, use action-oriented headlines that state the key finding.
8. Always cite specific numbers from the results.
9. If data cannot answer the question, say so clearly.
10. When the user says "last week" or "recently", interpret that relative to
    the latest date in the data, NOT today's date.
11. Table and column names are case-sensitive — use them EXACTLY as shown in
    the schema.

## Response Format
After executing queries, provide your analysis as plain text. Be concise — lead with the key finding, then supporting details."""


def chat_multi(
    message: str,
    schemas_by_source: dict[str, str],
    session_id: str,
    tool_executor: callable,
) -> dict:
    """Chat with multiple database schemas available."""
    provider = _detect_provider()
    if provider is None:
        return {
            "response_type": "error",
            "content": "No LLM API key configured.",
            "tool_results": [],
        }

    if session_id not in _sessions:
        _sessions[session_id] = []

    history = _sessions[session_id]
    history.append({"role": "user", "content": message})

    if len(history) > MAX_HISTORY * 2:
        history[:] = history[-(MAX_HISTORY * 2):]

    schema_context = "\n\n---\n\n".join(
        f"### Database: {source}\n{schema}" for source, schema in schemas_by_source.items()
    )

    source_ids = list(schemas_by_source.keys())
    system_prompt = build_multi_db_system_prompt(schema_context, source_ids)

    if provider == "anthropic":
        return _chat_anthropic_multi(history, system_prompt, session_id, tool_executor, source_ids)
    else:
        return _chat_openai_multi(history, system_prompt, session_id, tool_executor, source_ids)


def _chat_anthropic_multi(
    history: list, system_prompt: str, session_id: str, tool_executor: callable,
    source_ids: list[str],
) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=_anthropic_key)
    tool_results = []
    charts = []
    intermediate_steps = []
    step_number = 0
    messages = list(history)

    for _ in range(10):
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            tools=_anthropic_tools_multi(source_ids),
            messages=messages,
        )

        if response.stop_reason == "tool_use":
            assistant_content = response.content
            messages.append({"role": "assistant", "content": assistant_content})

            for block in assistant_content:
                if hasattr(block, "text") and block.text.strip():
                    step_number += 1
                    intermediate_steps.append({
                        "type": "thinking",
                        "step": step_number,
                        "content": block.text,
                    })

            tool_use_results = []
            for block in assistant_content:
                if block.type == "tool_use":
                    result = tool_executor(block.name, block.input)
                    tool_results.append({
                        "tool": block.name,
                        "input": block.input,
                        "result": result,
                    })

                    step_number += 1
                    intermediate_steps.append({
                        "type": "tool_call",
                        "step": step_number,
                        "tool": block.name,
                        "input": block.input,
                        "result_summary": _summarize_result(result),
                        "has_error": result.get("error", False),
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
        history.append({"role": "assistant", "content": final_text})

        return {
            "response_type": "analysis",
            "content": final_text,
            "tool_results": tool_results,
            "charts": charts,
            "intermediate_steps": intermediate_steps,
        }

    return _timeout_result(tool_results, charts, intermediate_steps)


def _chat_openai_multi(
    history: list, system_prompt: str, session_id: str, tool_executor: callable,
    source_ids: list[str],
) -> dict:
    from openai import OpenAI
    client = OpenAI(api_key=_openai_key)
    tool_results = []
    charts = []
    intermediate_steps = []
    step_number = 0

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    for _ in range(10):
        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=messages,
            tools=_openai_tools_multi(source_ids),
            tool_choice="auto",
        )

        choice = response.choices[0]

        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            if choice.message.content and choice.message.content.strip():
                step_number += 1
                intermediate_steps.append({
                    "type": "thinking",
                    "step": step_number,
                    "content": choice.message.content,
                })

            messages.append(choice.message)

            for tc in choice.message.tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)

                result = tool_executor(fn_name, fn_args)
                tool_results.append({
                    "tool": fn_name,
                    "input": fn_args,
                    "result": result,
                })

                step_number += 1
                intermediate_steps.append({
                    "type": "tool_call",
                    "step": step_number,
                    "tool": fn_name,
                    "input": fn_args,
                    "result_summary": _summarize_result(result),
                    "has_error": result.get("error", False),
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
        history.append({"role": "assistant", "content": final_text})

        return {
            "response_type": "analysis",
            "content": final_text,
            "tool_results": tool_results,
            "charts": charts,
            "intermediate_steps": intermediate_steps,
        }

    return _timeout_result(tool_results, charts, intermediate_steps)


def _timeout_result(tool_results, charts, intermediate_steps=None):
    return {
        "response_type": "error",
        "content": "Analysis exceeded maximum tool iterations.",
        "tool_results": tool_results,
        "charts": charts,
        "intermediate_steps": intermediate_steps or [],
    }


def _summarize_result(result: dict) -> str:
    """Create a brief human-readable summary of a tool result."""
    if result.get("error"):
        return f"Error: {result.get('message', 'unknown error')}"
    if "row_count" in result:
        hint = f" ⚠️ {result['hint']}" if result.get("hint") else ""
        return f"{result['row_count']} rows in {result.get('execution_ms', 0)}ms{hint}"
    if "filename" in result:
        return f"Chart: {result['filename']}"
    return "OK"
