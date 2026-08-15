import { useRef, useEffect, useState } from 'react';
import {
  X, Minus, Maximize2, Minimize2, Eraser, Send,
  Loader2, BookOpen,
} from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useDatasetStore } from '../stores/datasetStore';
import { useDashboardStore } from '../stores/dashboardStore';
import { usePipelineStore, getAgentLabel } from '../stores/pipelineStore';
import ChatBlockView from './ChatBlockView';
import './ChatPanel.css';

const SUGGESTIONS = [
  'What does this data look like?',
  'Show me revenue trends over time',
  'Compare conversion rates by device type',
  'Top 10 products by total revenue',
];

export default function ChatPanel() {
  const { messages, loading, panelState, setPanelState, send, clearMessages } = useChatStore();
  const { activeDataset, activeSource } = useDatasetStore();
  const pinChart = useDashboardStore((s) => s.pinChart);
  const pipeline = usePipelineStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [exportingNotion, setExportingNotion] = useState<string | null>(null);
  const [notionStatus, setNotionStatus] = useState<{ msgId: string; ok: boolean; message: string; url?: string } | null>(null);

  const autoResize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (panelState === 'docked' || panelState === 'expanded') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [panelState]);

  if (panelState === 'closed') {
    return (
      <button className="chat-fab" onClick={() => setPanelState('docked')} title="Open AI Chat">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || !activeDataset || !activeSource) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    const result = await send(msg, activeSource);
    if (result?.pipeline && result.run_id && result.agents) {
      pipeline.start(result.run_id, result.agents);
    }
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
    const msgIndex = messages.findIndex((m) => m.id === assistantMsgId);
    const assistantMsg = messages[msgIndex];
    if (!assistantMsg || !assistantMsg.blocks) return;

    setExportingNotion(assistantMsgId);
    setNotionStatus(null);

    let question = 'Analysis';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content) {
        question = messages[i].content!;
        break;
      }
    }

    const findings: { content: string }[] = [];
    const charts: { title: string; filename: string; path: string }[] = [];
    const sqlQueries: string[] = [];

    for (const block of assistantMsg.blocks) {
      if (block.type === 'text' && block.content) {
        findings.push({ content: block.content });
      }
      if (block.type === 'chart' && block.filename) {
        charts.push({
          title: block.title || 'Chart',
          filename: block.filename,
          path: `/api/charts/${block.filename}`,
        });
      }
      if (block.type === 'table' && block.sql) {
        sqlQueries.push(block.sql);
      }
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
        setNotionStatus({ msgId: assistantMsgId, ok: false, message: data.message || data.detail || 'Export failed' });
      } else {
        setNotionStatus({ msgId: assistantMsgId, ok: true, message: data.message || 'Exported to Notion!', url: data.notion_url });
      }
    } catch (e) {
      setNotionStatus({ msgId: assistantMsgId, ok: false, message: 'Export failed: ' + (e instanceof Error ? e.message : 'Unknown error') });
    }
    setExportingNotion(null);
  };

  const isExpanded = panelState === 'expanded';

  return (
    <>
      <div className={`chat-panel ${isExpanded ? 'expanded' : ''}`}>
        {/* Header */}
        <div className="chat-panel-header">
          <div className="chat-panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>AI Chat</span>
          </div>
          <div className="chat-panel-actions">
            <button onClick={clearMessages} title="Clear chat"><Eraser size={14} /></button>
            <button onClick={() => setPanelState('closed')} title="Minimize"><Minus size={14} /></button>
            <button onClick={() => setPanelState(isExpanded ? 'docked' : 'expanded')} title={isExpanded ? 'Dock' : 'Expand'}>
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button onClick={() => setPanelState('closed')} title="Close"><X size={14} /></button>
          </div>
        </div>

        {/* Pipeline progress bar */}
        {pipeline.status === 'running' && (
          <div className="chat-pipeline-bar">
            <div className="pipeline-bar-fill" style={{
              width: `${pipeline.agents.length > 0
                ? ((pipeline.completedAgents.length / pipeline.agents.length) * 100)
                : 0}%`
            }} />
            <span className="pipeline-bar-label">
              {pipeline.activeAgent ? getAgentLabel(pipeline.activeAgent) : 'Starting...'}
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 && !loading && (
            <div className="chat-welcome">
              <h3>Ask me anything</h3>
              <p>Ask questions about your data and I'll analyze it for you.</p>
              {activeDataset && (
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chat-suggestion" onClick={() => setInput(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`chat-msg ${msg.role}`}>
              {msg.role === 'user' ? (
                <div className="chat-msg-bubble user-bubble">{msg.content}</div>
              ) : (
                <div className="chat-msg-bubble assistant-bubble">
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
          ))}

          {loading && (
            <div className="chat-msg assistant">
              <div className="chat-msg-bubble assistant-bubble">
                <div className="chat-loading">
                  <Loader2 size={16} className="spin" />
                  <span>Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <div className="chat-input-wrap">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={activeDataset ? `Ask about ${activeDataset}...` : 'Select a dataset first...'}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              disabled={!activeDataset || loading}
              rows={1}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || !activeDataset || loading}
            >
              <Send size={16} />
            </button>
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
    </>
  );
}
