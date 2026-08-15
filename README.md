# Siftory

# Siftory — AI-Powered Product Analytics That Actually Analyzes

<div align="center">

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)
![DuckDB](https://img.shields.io/badge/DuckDB-Local%20Engine-FFC107?logo=duckdb)
![Snowflake](https://img.shields.io/badge/Snowflake-Warehouse-29B5E8?logo=snowflake)
![Databricks](https://img.shields.io/badge/Databricks-Warehouse-FF3621?logo=databricks)
![Claude](https://img.shields.io/badge/Claude-Anthropic-blueviolet?logo=anthropic)
![GPT](https://img.shields.io/badge/GPT--4o-OpenAI-412991?logo=openai)
![Agents](https://img.shields.io/badge/Agent%20Templates-43-informational)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Dataset](https://img.shields.io/badge/Demo%20Data-8M+%20Rows-orange)

</div>

---

An intelligent analytics platform that takes a natural language question, routes it through the right analytical workflow, and returns validated findings with SQL, charts, and narrative — not a chatbot with a database connection.

--- 



https://github.com/user-attachments/assets/b1c5ee49-0b92-40df-b6fd-b8de3d0fad3d

--- 

## Background

Companies spend millions on data infrastructure — Snowflake, Databricks, carefully modeled warehouses — and then the last mile is still a person writing SQL in a notebook, stitching together charts, and drafting a summary in a doc. The pipeline from question to decision is manual, slow, and doesn't scale.

Siftory exists to close that gap. Not by replacing the analyst, but by encoding the way a good one actually works — framing the business question before touching data, generating hypotheses, segmenting and validating before drawing conclusions, and packaging findings into something a stakeholder can act on.

> The question "Why did activation drop in Q3?" isn't answered by a single query. It requires a workflow — and that workflow is what Siftory automates.

Connect your Snowflake, Databricks, or PostgreSQL warehouse. Upload a CSV. Or start immediately with the bundled NovaMart demo dataset (13 tables, 8M+ rows). Works with Claude (Anthropic) or GPT-4o (OpenAI).

---

## What Makes This Different

### Question Complexity Routing

Every question gets classified into one of five levels. Each level gets a fundamentally different treatment — not just a longer prompt.

| Level | Type | Example | What Happens |
|-------|------|---------|--------------|
| L1 | Lookup | "How many users signed up last month?" | Direct SQL, immediate answer |
| L2 | Comparison | "Compare revenue by device type" | SQL + auto-generated chart |
| L3 | Analysis | "Why did conversion drop in December?" | 4-agent pipeline with validation |
| L4 | Investigation | "Root cause of revenue decline — size the opportunity" | 8-agent pipeline with cross-verification |
| L5 | Presentation | "Full pipeline: checkout funnel optimization" | 15-agent pipeline producing a slide deck |

L1–L2 questions resolve in a single LLM call. L3–L5 spin up a coordinated pipeline of specialized agents, each building on the previous one's output, with real-time progress streaming to the sidebar.

### The Agent Pipeline

For L3+ questions, analysis isn't one step — it's twelve. Each agent handles a specific analytical role:

| Agent | Role |
|-------|------|
| Question Framing | Structures the business question before any data is touched |
| Hypothesis Generation | Proposes testable explanations |
| Data Explorer | Profiles the dataset and identifies relevant tables |
| Descriptive Analytics | Runs segmentation, funnels, and trend analysis |
| Root Cause Investigator | Drills down iteratively to find actionable causes |
| Cross-Verification | Re-derives key findings through independent calculations |
| Validation | 4-layer check — structural, logical, business rules, Simpson's paradox |
| Opportunity Sizer | Quantifies business impact with sensitivity analysis |
| Story Architect + Storytelling | Builds a narrative arc from findings |
| Chart Maker + Visual Design Critic | Generates SWD-style charts with review |
| Deck Creator | Assembles a Marp slide deck |
| Communications Drafter | Generates stakeholder-ready summaries |

The pipeline selects and sequences agents based on what the question requires. An L3 gets four agents. An L5 gets all of them.

### Multi-Warehouse Connectivity

This isn't locked to local CSVs. Connect to production warehouses and analyze live data:

| Provider | Connection |
|----------|------------|
| DuckDB (local) | Upload CSVs directly through the UI — auto-ingested |
| Snowflake | Account, user, password, warehouse, database, schema |
| Databricks | Server hostname, HTTP path, access token |
| PostgreSQL | Host, port, database, user, password |

The Master Analyzer page lets you select multiple data sources and ask cross-database questions in a single session.

### Experiment and Causal Inference Tools

Production-grade statistical modules, not toy implementations:

| Capability | Methods |
|------------|---------|
| A/B Testing | Welch's t-test, proportion tests, ratio metrics |
| Power Analysis | Sample size estimation, minimum detectable effect |
| Integrity Checks | Sample Ratio Mismatch (SRM) detection |
| Bayesian Analysis | Posterior distributions, expected loss |
| Sequential Testing | Always-valid p-values, confidence sequences |
| Causal Inference | Diff-in-diff, propensity score matching, regression adjustment, sensitivity analysis |

---

## The Interface

Charts follow Storytelling with Data principles throughout: action-oriented titles that state the finding, strategic color highlighting, clean aesthetics. Chart types include bar, line, grouped bar, stacked bar, funnel, retention heatmaps, slope charts, and forecast plots.

The frontend is React + TypeScript with Zustand for state management. The design follows an analyst workspace pattern — structured content cards, not chat bubbles.

| Welcome Screen | Data Profile | Pipeline Analysis |
|---|---|---|
| Upload CSV or connect a warehouse | Auto-profiled schema with quality grades | Multi-agent analysis with real-time progress |

---

## Quick Start

### Prerequisites

| Requirement | Details |
|-------------|---------|
| Python | 3.10+ |
| Node.js | 18+ (only if modifying the frontend) |
| LLM API Key | [Anthropic](https://console.anthropic.com/) or [OpenAI](https://platform.openai.com/api-keys) |

### Setup

```bash
git clone <repository-url>
cd siftory

# Create virtual environment and install
python3 -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate
pip install -e ".[all]"
```

### Configure

```bash
cp .env.example .env
```

Add your API key to `.env`:

```env
# Pick one (or both — auto-detects, or force with ACTIVE_LLM_PROVIDER):
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
```

### Run

```bash
uvicorn web.app:app --reload --port 8000
```

Open **http://localhost:8000**. The NovaMart demo dataset is pre-loaded — start asking questions immediately.

---

## How It Works

### Architecture

Three layers. The frontend is React in production, with a vanilla HTML/CSS/JS fallback for zero-dependency use.

```
Frontend (React + TypeScript / Vite)
    ↕ REST API + SSE
Backend (FastAPI)
    ↕ DuckDB (local) / Snowflake / Databricks / PostgreSQL / LLM APIs
Data + AI
```

### The Chat Pipeline

1. User types a question
2. `analysis_service.py` classifies it into L1–L5
3. **L1–L2:** Question + schema context + SQL/chart tools go to the LLM in a single call. Response is immediate.
4. **L3–L5:** `pipeline_orchestrator.py` creates a run, selects agents from `registry.yaml`, and executes them sequentially. Each agent is a markdown prompt template with `{{VARIABLE}}` placeholders substituted at runtime. The LLM executes each agent with `execute_sql`, `generate_chart`, and `write_finding` tools. Progress streams to the frontend via SSE.

### Pipeline Plans by Complexity

| Level | Plan | Agent Chain |
|-------|------|-------------|
| L3 | Guided Analysis | question-framing → data-explorer → descriptive-analytics → validation |
| L4 | Deep Investigation | + hypothesis, root-cause-investigator, cross-verification, opportunity-sizer |
| L5 | Full Presentation | + story-architect, chart-maker, storytelling, deck-creator, comms-drafter |

---

## Using the Platform

**Upload your own data** — go to the Datasets page, upload a CSV. It's ingested into a local DuckDB instance and immediately queryable.

**Connect a warehouse** — go to the Connections page, enter credentials for Snowflake, Databricks, or PostgreSQL. Credentials are stored securely in `.env`, never in the database metadata.

**Ask a question** — type in the chat bar on the Dashboard. For L3+ questions, the sidebar shows real-time agent progress as each step executes: Framing → Exploring → Analyzing → Validating → Presenting.

**Cross-database analysis** — the Master Analyzer page lets you select multiple data sources and ask questions that span them.

**Export to Notion** — push findings, charts, and SQL queries to a structured Notion page for stakeholder distribution.

---

## NovaMart Demo Dataset

The bundled dataset simulates a mid-size e-commerce company across 13 tables. It's designed for real analytical work — realistic enough to practice on, messy enough to be interesting.

| Table | Description | Scale |
|-------|-------------|-------|
| `users` | Customer profiles | ~150K |
| `orders` | Purchase transactions | ~470K |
| `products` | Product catalog | ~200 |
| `promotions` | Discount campaigns | ~20 |
| `categories` | Product categories | ~10 |
| `sessions` | Website sessions | ~1.4M |
| `events` | Granular user events | ~6.5M |
| `order_items` | Line items per order | ~750K |
| `memberships` | NovaMart Plus subscriptions | ~55K |
| `experiments` | A/B test definitions | 2 |
| `experiment_assignments` | User–experiment assignments | ~200K |
| `nps_responses` | Net Promoter Score surveys | ~80K |
| `channels` | Marketing channels | ~8 |

Data covers Jan–Dec 2024 with realistic patterns: power-law user activity, hourly traffic curves, seasonal trends, and intentional data quirks for learning. The `.knowledge/datasets/novamart/` directory contains schema documentation, metric definitions, and semantic context that agents use during analysis.

---

## Project Structure

```
siftory/
├── web/                        # FastAPI backend + React frontend
│   ├── app.py                  # Application entry point
│   ├── config.py               # Path configuration
│   ├── routers/                # API route handlers
│   │   ├── analyzer.py         #   Master analyzer (multi-source chat)
│   │   ├── charts.py           #   Chart serving
│   │   ├── connections.py      #   External warehouse connections
│   │   ├── datasets.py         #   Dataset management + upload
│   │   ├── models.py           #   LLM provider management
│   │   ├── notion_export.py    #   Notion integration
│   │   ├── pipeline.py         #   Analysis pipeline orchestration
│   │   ├── query.py            #   SQL query execution
│   │   └── schema.py           #   Schema profiling
│   ├── services/               # Business logic
│   │   ├── analysis_service.py #   Chat + question classification
│   │   ├── agent_executor.py   #   Multi-agent pipeline runner
│   │   ├── chart_service.py    #   SWD-style chart generation
│   │   ├── connection_service.py #  Warehouse connection manager
│   │   ├── dataset_service.py  #   CSV ingestion + dataset listing
│   │   ├── llm_service.py      #   LLM provider abstraction
│   │   ├── pipeline_orchestrator.py # Multi-agent pipeline coordination
│   │   └── query_service.py    #   SQL execution + schema context
│   ├── models/schemas.py       # Pydantic request/response models
│   ├── static/                 # Legacy static frontend (fallback)
│   └── frontend/               # React + TypeScript frontend
│       ├── src/
│       │   ├── components/     #   Reusable UI components
│       │   ├── pages/          #   Route-level pages
│       │   ├── stores/         #   Zustand state management
│       │   └── api/            #   API client
│       └── dist/               #   Pre-built production bundle
├── helpers/                    # Python computation modules
│   ├── chart_helpers.py        #   SWD chart rendering functions
│   ├── chart_palette.py        #   Theme-aware color palettes
│   ├── connection_manager.py   #   Multi-warehouse connection abstraction
│   ├── sql_dialect.py          #   Warehouse-specific SQL adapters
│   ├── experiment_stats/       #   A/B test & statistical modules
│   │   ├── ab_tests.py         #   Welch's t-test, proportion tests
│   │   ├── power.py            #   Power analysis, sample sizing
│   │   ├── bayesian.py         #   Bayesian posterior analysis
│   │   ├── sequential.py       #   Sequential testing
│   │   ├── srm.py              #   Sample ratio mismatch detection
│   │   └── causal/             #   Causal inference methods
│   └── dialects/               #   SQL dialect implementations
├── agents/                     # AI agent prompt templates
│   ├── registry.yaml           #   Agent dependency graph
│   └── *.md                    #   Individual agent prompts (43 total)
├── themes/                     # Chart & deck theme definitions
├── templates/                  # Deck and report templates
├── data/
│   ├── practice/               #   Demo datasets (NovaMart)
│   ├── uploads/                #   User-uploaded CSVs
│   └── experiments/            #   Experiment test datasets
├── .knowledge/
│   └── datasets/novamart/      #   Schema, metrics, semantic context
└── tests/                      # Test suite
```

---

## Security

This runs LLM-generated SQL against your data — potentially against production warehouses — so the guardrails matter.

| Layer | Protection |
|-------|------------|
| SQL filtering | Only `SELECT` and `WITH` (CTE) queries allowed. Destructive statements blocked by regex filter. |
| Database access | Query connections opened in read-only mode |
| File uploads | Only `.csv` accepted, with size limits enforced |
| Path traversal | Chart filenames validated — no `..` or `/` |
| Credentials | All API keys and warehouse passwords loaded from `.env` — nothing hardcoded, nothing stored in database metadata |

---

## Configuration

### LLM Provider

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (GPT-4o) |
| `ANTHROPIC_API_KEY` | Anthropic API key (Claude) |
| `ACTIVE_LLM_PROVIDER` | Force a provider: `openai` or `anthropic`. Auto-detects if blank. |

### Notion Export (optional)

| Variable | Description |
|----------|-------------|
| `NOTION_API_KEY` | Notion integration token |
| `NOTION_PARENT_PAGE_ID` | Page ID where exports are created |

---

## Development

### Frontend

```bash
cd web/frontend
npm install
npm run dev     # Vite dev server on :5173
```

FastAPI proxies requests from the Vite dev server during development. In production, the pre-built `dist/` bundle is served directly.

### Adding a New Agent

1. Create a `.md` file in `agents/` with the prompt template
2. Use `{{VARIABLE}}` placeholders for runtime substitution
3. Add the entry to `agents/registry.yaml`
4. Reference the agent name in `PIPELINE_PLANS` in `pipeline_orchestrator.py`

### Tests

```bash
pytest                              # All tests
pytest tests/test_chart_palette.py  # Single file
pytest -m "not slow"                # Skip slow tests
```

---

## Why This Project Exists

There's a meaningful difference between a tool that can query a database and one that can analyze data. The first converts English to SQL. The second requires structured thinking that a single LLM call can't sustain — framing the right question, generating hypotheses, testing them against evidence, validating conclusions before presenting them, and quantifying the business impact.

Most AI analytics tools are the first kind dressed up as the second. They answer "what happened" and leave "why" and "what should we do about it" to the human.

Siftory bridges that gap with a multi-agent architecture where each agent handles one step of the analytical process. The question complexity router ensures simple lookups don't get over-engineered, and complex questions don't get under-analyzed. The result isn't a chatbot that knows SQL — it's a system that follows the same workflow a senior analyst would, from question framing through stakeholder-ready output.

The 43 agent templates and the four-layer validation pipeline are the headline. The warehouse connectivity, the experiment toolkit, and the SWD-style output are what make it production-ready.

---

## License

MIT — see [LICENSE](LICENSE) for details.
