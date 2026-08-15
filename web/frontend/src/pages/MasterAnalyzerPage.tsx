import { useRef, useEffect, useState } from 'react';
import {
  Send, Loader2, BookOpen, X, Eraser, Database, Plug,
} from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useDatasetStore } from '../stores/datasetStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useDashboardStore } from '../stores/dashboardStore';
import ChatBlockView from '../components/ChatBlockView';
import './MasterAnalyzerPage.css';

const SUGGESTIONS = [
  'What does this data look like?',
  'Show me revenue trends over time',
  'Compare conversion rates by device type',
  'Which products have the highest margins?',
  'Analyze user retention by cohort',
  'Top 10 products by total revenue',
];

interface SourceOption {
  id: string;
  label: string;
  type: 'dataset' | 'connection';
}

export default function MasterAnalyzerPage() {
  const {
    analyzerMessages, analyzerLoading, sendAnalyzer, clearAnalyzer,
  } = useChatStore();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeSource = useDatasetStore((s) => s.activeSource);
  const connections = useConnectionStore((s) => s.connections);
  const pinChart = useDashboardStore((s) => s.pinChart);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [exportingNotion, setExportingNotion] = useState<string | null>(null);
  const [notionStatus, setNotionStatus] = useState<{ msgId: string; ok: boolean; message: string; url?: string } | null>(null);

  // Build available sources by grouping datasets by their source field + external connections
  const availableSources: SourceOption[] = [];
  const sourceGroups = new Map<string, number>();
  for (const ds of datasets) {
    sourceGroups.set(ds.source, (sourceGroups.get(ds.source) || 0) + 1);
  }
  for (const [source, count] of sourceGroups) {
    let label: string;
    if (source === 'novamart_demo') {
      label = `NovaMart Demo (${count})`;
    } else if (source === 'upload') {
      label = `Uploaded Data (${count})`;
    } else {
      label = `${source} (${count})`;
    }
    availableSources.push({ id: source, label, type: 'dataset' });
  }
  for (const conn of connections) {
    if (conn.category === 'integration') continue;
    availableSources.push({
      id: `conn:${conn.id}`,
      label: conn.display_name || conn.id,
      type: 'connection',
    });
  }

  // Initialize selected sources from active source
  useEffect(() => {
    if (selectedSources.length === 0 && activeSource) {
      setSelectedSources([activeSource]);
    } else if (selectedSources.length === 0 && availableSources.length > 0) {
      setSelectedSources([availableSources[0].id]);
    }
  }, [activeSource, availableSources.length]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analyzerMessages, analyzerLoading]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const autoResize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources((prev) => {
      if (prev.includes(sourceId)) {
        return prev.length > 1 ? prev.filter((s) => s !== sourceId) : prev;
      }
      return [...prev, sourceId];
    });
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || selectedSources.length === 0) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    await sendAnalyzer(msg, selectedSources);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveChart = (url: string, title: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = (title || 'chart').replace(/[^a-zA-Z0-9_-]/g, '_') + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePinChart = (url: string, title: string, sql?: string) => {
    pinChart({ title: title || 'Chart', imageUrl: url, sql });
  };

  const handleExportNotion = async (assistantMsgId: string) => {
    const msgIndex = analyzerMessages.findIndex((m) => m.id === assistantMsgId);
    const assistantMsg = analyzerMessages[msgIndex];
    if (!assistantMsg || !assistantMsg.blocks) return;

    setExportingNotion(assistantMsgId);
    setNotionStatus(null);

    let question = 'Analysis';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (analyzerMessages[i].role === 'user' && analyzerMessages[i].content) {
        question = analyzerMessages[i].content!;
        break;
      }
    }

    const findings: { content: string }[] = [];
    const charts: { title: string; filename: string; path: string }[] = [];
    const sqlQueries: string[] = [];

    for (const block of assistantMsg.blocks) {
      if (block.type === 'text' && block.content) findings.push({ content: block.content });
      if (block.type === 'chart' && block.filename) {
        charts.push({ title: block.title || 'Chart', filename: block.filename, path: `/api/charts/${block.filename}` });
      }
      if (block.type === 'table' && block.sql) sqlQueries.push(block.sql);
      if (block.type === 'tool_call' && block.tool === 'execute_sql' && block.input && 'sql' in block.input) {
        sqlQueries.push(String(block.input.sql));
      }
    }

    try {
      const res = await fetch('/api/export/notion/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, findings, charts, sql_queries: sqlQueries }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNotionStatus({ msgId: assistantMsgId, ok: false, message: data.message || 'Export failed' });
      } else {
        setNotionStatus({ msgId: assistantMsgId, ok: true, message: data.message || 'Exported to Notion!', url: data.notion_url });
      }
    } catch (e) {
      setNotionStatus({ msgId: assistantMsgId, ok: false, message: 'Export failed: ' + (e instanceof Error ? e.message : 'Unknown error') });
    }
    setExportingNotion(null);
  };

  const hasMessages = analyzerMessages.length > 0;

  return (
    <div className="page ma-page">
      {/* Header bar */}
      <div className="ma-header">
        <div className="ma-header-left">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" fill="#0AE7B1" opacity="0.9" />
            <path d="M12 6l-4 2.5v5L12 16l4-2.5v-5L12 6z" fill="#fff" opacity="0.3" />
          </svg>
          <span className="ma-header-title">Master Analyzer</span>
        </div>
        <div className="ma-header-actions">
          {hasMessages && (
            <button className="ma-header-btn" onClick={clearAnalyzer} title="New chat">
              <Eraser size={15} />
              <span>New Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Database source selector */}
      <div className="ma-source-bar">
        <div className="ma-source-label">
          <Database size={14} />
          <span>Data Sources</span>
        </div>
        <div className="ma-source-pills">
          {availableSources.map((src) => (
            <button
              key={src.id}
              className={`ma-source-pill ${selectedSources.includes(src.id) ? 'selected' : ''}`}
              onClick={() => toggleSource(src.id)}
            >
              {src.type === 'connection' ? <Plug size={12} /> : <Database size={12} />}
              {src.label}
            </button>
          ))}
          {availableSources.length === 0 && (
            <span className="ma-source-empty">No data sources available — upload a CSV or add a connection</span>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="ma-chat-container">
        <div className="ma-chat-scroll">
          {/* Welcome screen */}
          {!hasMessages && !analyzerLoading && (
            <div className="ma-welcome">
              <div className="ma-welcome-logo">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" fill="#0AE7B1" opacity="0.9" />
                  <path d="M12 6l-4 2.5v5L12 16l4-2.5v-5L12 6z" fill="#fff" opacity="0.3" />
                </svg>
              </div>
              <h2 className="ma-welcome-title">What would you like to analyze?</h2>
              <p className="ma-welcome-subtitle">
                Ask questions in natural language — I'll write SQL, run it, and visualize the results.
              </p>
              <div className="ma-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="ma-suggestion" onClick={() => setInput(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message thread */}
          {analyzerMessages.map((msg) => (
            <div key={msg.id} className={`ma-msg ${msg.role}`}>
              <div className={`ma-msg-content ${msg.role}`}>
                {msg.role === 'user' ? (
                  <div className="ma-msg-user">{msg.content}</div>
                ) : (
                  <div className="ma-msg-assistant">
                    {msg.blocks?.map((block, i) => (
                      <ChatBlockView
                        key={i}
                        block={block}
                        onPin={handlePinChart}
                        onSave={handleSaveChart}
                        onExpand={setExpandedChart}
                      />
                    ))}
                    {msg.blocks && msg.blocks.length > 0 && (
                      <div className="msg-export-row">
                        <button
                          className="msg-export-btn"
                          onClick={() => handleExportNotion(msg.id)}
                          disabled={exportingNotion === msg.id}
                        >
                          {exportingNotion === msg.id ? <Loader2 size={14} className="spin" /> : <BookOpen size={14} />}
                          {exportingNotion === msg.id ? 'Exporting...' : 'Export to Notion'}
                        </button>
                        {notionStatus && notionStatus.msgId === msg.id && (
                          <span className={`notion-status ${notionStatus.ok ? 'success' : 'error'}`}>
                            {notionStatus.message}
                            {notionStatus.ok && notionStatus.url && (
                              <a href={notionStatus.url} target="_blank" rel="noopener noreferrer"> Open →</a>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {analyzerLoading && (
            <div className="ma-msg assistant">
              <div className="ma-msg-content assistant">
                <div className="ma-msg-assistant">
                  <div className="chat-loading">
                    <Loader2 size={16} className="spin" />
                    <span>Analyzing...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area — pinned to bottom */}
        <div className="ma-input-area">
          <div className="ma-input-wrap">
            <textarea
              ref={inputRef}
              className="ma-input"
              placeholder={
                selectedSources.length > 0
                  ? 'Ask anything about your data...'
                  : 'Select a data source above to begin...'
              }
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              disabled={selectedSources.length === 0 || analyzerLoading}
              rows={1}
            />
            <button
              className="ma-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || selectedSources.length === 0 || analyzerLoading}
            >
              <Send size={18} />
            </button>
          </div>
          <div className="ma-input-footer">
            <span>
              {selectedSources.length} source{selectedSources.length !== 1 ? 's' : ''} selected
            </span>
            <span>Enter to send · Shift+Enter for new line</span>
          </div>
        </div>
      </div>

      {/* Chart modal */}
      {expandedChart && (
        <div className="chart-modal-overlay" onClick={() => setExpandedChart(null)}>
          <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
            <button className="chart-modal-close" onClick={() => setExpandedChart(null)}>
              <X size={20} />
            </button>
            <img src={expandedChart} alt="Chart" className="chart-modal-img" />
          </div>
        </div>
      )}
    </div>
  );
}
