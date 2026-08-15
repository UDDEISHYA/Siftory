from __future__ import annotations

import sys
import threading
import uuid
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from web.config import CHART_OUTPUT_DIR, BASE_DIR

sys.path.insert(0, str(BASE_DIR))

from helpers.chart_helpers import (
    swd_style,
    highlight_bar,
    highlight_line,
    action_title,
    save_chart,
    stacked_bar,
    funnel_waterfall,
    grouped_bar,
    CHART_FIGSIZE,
)

_chart_lock = threading.Lock()


def _new_filename() -> str:
    return f"chart_{uuid.uuid4().hex[:10]}.png"


def generate_bar_chart(
    data: dict,
    x_col: str,
    y_col: str,
    title: str | None = None,
    highlight: str | None = None,
) -> str:
    with _chart_lock:
        colors = swd_style()
        fig, ax = plt.subplots(figsize=CHART_FIGSIZE)

        categories = [str(v) for v in data[x_col]]
        values = [float(v) if v is not None else 0 for v in data[y_col]]

        highlight_bar(ax, categories, values, highlight=highlight)
        if title:
            action_title(ax, title)

        filename = _new_filename()
        save_chart(fig, str(CHART_OUTPUT_DIR / filename))
        return filename


def generate_line_chart(
    data: dict,
    x_col: str,
    y_col: str | list[str],
    title: str | None = None,
    highlight: str | None = None,
) -> str:
    with _chart_lock:
        colors = swd_style()
        fig, ax = plt.subplots(figsize=CHART_FIGSIZE)

        x_values = data[x_col]
        try:
            x_values = pd.to_datetime(x_values)
        except Exception:
            pass

        if isinstance(y_col, list):
            y_dict = {col: data[col] for col in y_col}
            hl = highlight or y_col[0]
            highlight_line(ax, x_values, y_dict, highlight=hl)
        else:
            ax.plot(x_values, data[y_col], color=colors.get("action", "#D97706"), linewidth=2)
            ax.fill_between(
                range(len(x_values)) if not hasattr(x_values, 'values') else x_values,
                data[y_col],
                alpha=0.08,
                color=colors.get("action", "#D97706"),
            )

        if title:
            action_title(ax, title)

        filename = _new_filename()
        save_chart(fig, str(CHART_OUTPUT_DIR / filename))
        return filename


def generate_grouped_bar(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    group_col: str,
    title: str | None = None,
) -> str:
    with _chart_lock:
        swd_style()
        fig, ax = plt.subplots(figsize=CHART_FIGSIZE)
        grouped_bar(df, x_col, y_col, group_col, ax=ax)
        if title:
            action_title(ax, title)
        filename = _new_filename()
        save_chart(fig, str(CHART_OUTPUT_DIR / filename))
        return filename


def generate_chart_from_spec(
    chart_type: str,
    data: dict,
    x_col: str,
    y_col: str,
    title: str | None = None,
    highlight: str | None = None,
    group_col: str | None = None,
) -> str:
    if chart_type == "line":
        return generate_line_chart(data, x_col, y_col, title, highlight)
    elif chart_type == "grouped_bar" and group_col:
        df = pd.DataFrame(data)
        return generate_grouped_bar(df, x_col, y_col, group_col, title)
    else:
        return generate_bar_chart(data, x_col, y_col, title, highlight)
