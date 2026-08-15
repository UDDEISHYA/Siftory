from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class DatasetInfo(BaseModel):
    table_name: str
    source: str
    row_count: int
    column_count: int
    columns: list[dict[str, Any]]


class DatasetListResponse(BaseModel):
    datasets: list[DatasetInfo]


class UploadResponse(BaseModel):
    table_name: str
    row_count: int
    columns: list[dict[str, Any]]
    status: str


class ProfileColumn(BaseModel):
    name: str
    type: str
    nullable: bool
    null_count: int
    null_pct: float
    n_unique: int
    sample_values: list[Any]
    min_val: Any | None = None
    max_val: Any | None = None


class ProfileTable(BaseModel):
    name: str
    row_count: int
    columns: list[ProfileColumn]


class ProfileResponse(BaseModel):
    dataset: str
    tables: list[ProfileTable]
    quality: dict[str, Any] | None = None


class QueryRequest(BaseModel):
    sql: str
    dataset: str


class QueryResponse(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    execution_ms: float


class ChatRequest(BaseModel):
    message: str
    dataset: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    response_type: str
    content: Any
    explanation: str | None = None
    chart_url: str | None = None
    sql: str | None = None


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None


# ── Phase 6: Connection Hub + Transparent Chat ──


class ConnectionCreate(BaseModel):
    connection_id: str
    provider: str
    display_name: str
    credentials: dict[str, str]


class ConnectionResponse(BaseModel):
    id: str
    provider: str
    display_name: str
    connected: bool
    tables_count: int = 0
    category: str = "data_source"


class ThinkingBlock(BaseModel):
    type: str = "thinking"
    step: int
    content: str


class ToolCallBlock(BaseModel):
    type: str = "tool_call"
    step: int
    tool: str
    input: dict[str, Any]
    result_summary: str
    has_error: bool = False


class NotionChartExportRequest(BaseModel):
    chart_filename: str
    title: str
    caption: str = ""
    sql: str = ""


class NotionAnalysisExportRequest(BaseModel):
    question: str
    findings: list[dict[str, Any]] = []
    charts: list[dict[str, Any]] = []
    sql_queries: list[str] = []
