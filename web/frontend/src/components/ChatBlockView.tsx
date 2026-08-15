import { useState } from 'react';
import {
  Pin, Expand, Download, Brain, Wrench,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { chartUrl } from '../api/client';
import type { ChatBlock } from '../api/client';

interface ChatBlockViewProps {
  block: ChatBlock;
  onPin: (url: string, title: string, sql?: string) => void;
  onSave: (url: string, title: string) => void;
  onExpand: (url: string) => void;
}

export default function ChatBlockView({ block, onPin, onSave, onExpand }: ChatBlockViewProps) {
  const [sqlOpen, setSqlOpen] = useState(false);
  const [stepOpen, setStepOpen] = useState(false);

  if (block.type === 'thinking') {
    return (
      <div className="block-thinking">
        <button className="block-step-toggle" onClick={() => setStepOpen(!stepOpen)}>
          <Brain size={14} className="step-icon thinking-icon" />
          <span className="step-label">Step {block.step}: Reasoning</span>
          {stepOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {stepOpen && (
          <div className="block-step-content">
            <div className="block-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content || '') }} />
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'tool_call') {
    const isSQL = block.tool === 'execute_sql';
    const toolLabel = isSQL ? 'SQL Query' : block.tool === 'generate_chart' ? 'Generate Chart' : (block.tool || 'Tool');
    return (
      <div className={`block-tool-call ${block.has_error ? 'tool-error' : ''}`}>
        <button className="block-step-toggle" onClick={() => setStepOpen(!stepOpen)}>
          <Wrench size={14} className="step-icon tool-icon" />
          <span className="step-label">Step {block.step}: {toolLabel}</span>
          <span className="step-result-badge">{block.result_summary}</span>
          {stepOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {stepOpen && (
          <div className="block-step-content">
            {isSQL && block.input && 'sql' in block.input && (
              <pre className="block-sql-code">{String((block.input as Record<string, unknown>).sql)}</pre>
            )}
            {!isSQL && block.input && (
              <pre className="block-step-json">{JSON.stringify(block.input, null, 2)}</pre>
            )}
            <div className="step-result-line">&rarr; {block.result_summary}</div>
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'text') {
    return <div className="block-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content || '') }} />;
  }

  if (block.type === 'error') {
    return <div className="block-error">{block.content}</div>;
  }

  if (block.type === 'chart') {
    const url = chartUrl(block.filename!);
    return (
      <div className="block-chart">
        {block.title && <div className="block-chart-title">{block.title}</div>}
        <img src={url} alt={block.title || 'Chart'} className="block-chart-img" />
        <div className="chart-action-row">
          <button className="chart-action-btn" onClick={() => onPin(url, block.title || 'Chart', block.sql)}>
            <Pin size={13} /> Add to Dashboard
          </button>
          <button className="chart-action-btn" onClick={() => onExpand(url)}>
            <Expand size={13} /> Expand View
          </button>
          <button className="chart-action-btn" onClick={() => onSave(url, block.title || 'chart')}>
            <Download size={13} /> Save Chart
          </button>
        </div>
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="block-table-wrap">
        <div className="block-table-meta">
          {block.row_count?.toLocaleString()} rows &middot; {block.execution_ms}ms
        </div>
        <div className="block-table-scroll">
          <table className="block-table">
            <thead>
              <tr>{block.columns?.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows?.slice(0, 20).map((row, ri) => (
                <tr key={ri}>
                  {row.map((val, ci) => (
                    <td key={ci}>{val === null ? <span className="null-val">null</span> : String(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {block.sql && (
          <div className="block-sql-section">
            <button className="block-sql-toggle" onClick={() => setSqlOpen(!sqlOpen)}>
              {sqlOpen ? '▾' : '▸'} SQL
            </button>
            {sqlOpen && <pre className="block-sql-code">{block.sql}</pre>}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n- /g, '<br/>&#8226; ');
  html = html.replace(/\n(\d+)\. /g, '<br/>$1. ');
  return `<p>${html}</p>`;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
