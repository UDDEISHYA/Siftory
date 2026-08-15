"""Tests for the /trace viewer (provenance, 0.9)."""
from __future__ import annotations

from helpers.trace_viewer import render_trace, build_trace


PROVENANCE = {
    "analysis_id": "an_t",
    "findings": [
        {"finding_id": "an_t.f01", "value": 3150899.34, "text": "completed revenue"},
        {"finding_id": "an_t.f02", "value": 777, "text": "unverified number"},
    ],
    "query_entries": [
        {"query_id": "q1", "result_value": 3150899.34, "sql": "select sum(total_amount) from orders",
         "tables_accessed": ["orders"], "row_count": 1, "timestamp": "2026-06-27T10:00:00"},
    ],
    "links": [{"finding_id": "an_t.f01", "query_id": "q1", "confidence": "value-match"}],
    "unmatched_findings": ["an_t.f02"],
    "orphan_queries": [],
}


def test_render_trace_shows_chain_and_flags(tmp_path):
    out = tmp_path / "trace.html"
    render_trace(PROVENANCE, out)
    doc = out.read_text()
    assert "3150899.34" in doc                       # the finding value
    assert 'class="badge value-match"' in doc        # confidence badge
    assert "select sum(total_amount) from orders" in doc  # the SQL it traces to
    assert "Unmatched findings" in doc and "an_t.f02" in doc  # unverified surfaced, not hidden
    assert doc.startswith("<!doctype html>")          # self-contained


def test_build_trace_end_to_end(tmp_path):
    from helpers import query_log as ql
    from helpers.findings import record_finding
    ql.set_log_dir(tmp_path)
    record_finding(42.0, "the answer", analysis_id="an_e2e", working_dir=tmp_path)
    ql.append_entry("ds", "2026-06-27", "auto-hook", 0, "p", "select 42",
                    analysis_id="an_e2e", result_value=42.0)
    path = build_trace("an_e2e", "ds", "2026-06-27", working_dir=tmp_path)
    doc = open(path).read()
    assert "the answer" in doc and 'class="badge value-match"' in doc
