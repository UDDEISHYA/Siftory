import { useNavigate } from 'react-router-dom';
import { BarChart3, X, Expand, Download, MessageSquare, Upload, Plug } from 'lucide-react';
import { useDatasetStore } from '../stores/datasetStore';
import { useDashboardStore } from '../stores/dashboardStore';
import { useChatStore } from '../stores/chatStore';
import { useConnectionStore } from '../stores/connectionStore';
import './DashboardPage.css';

export default function DashboardPage() {
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDataset = useDatasetStore((s) => s.activeDataset);
  const { pinnedCharts, unpinChart } = useDashboardStore();
  const setPanelState = useChatStore((s) => s.setPanelState);
  const messages = useChatStore((s) => s.messages);
  const connections = useConnectionStore((s) => s.connections);
  const navigate = useNavigate();

  const totalRows = datasets.reduce((sum, d) => sum + d.row_count, 0);
  const connCount = connections.filter((c) => c.category !== 'integration').length;

  const handleSaveChart = (url: string, title: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = (title || 'chart').replace(/[^a-zA-Z0-9_-]/g, '_') + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const recentMessages = messages.slice(-5).reverse();

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {activeDataset ? `Active dataset: ${activeDataset}` : 'Select a dataset to begin'}
        </p>
      </div>

      {/* Metric cards */}
      <div className="dashboard-metrics">
        <div className="metric-card">
          <div className="metric-label">Total Tables</div>
          <div className="metric-value">{datasets.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Rows</div>
          <div className="metric-value">{formatNumber(totalRows)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Connections</div>
          <div className="metric-value">{connCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pinned Charts</div>
          <div className="metric-value">{pinnedCharts.length}</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="quick-actions">
        <button onClick={() => setPanelState('docked')}>
          <MessageSquare size={16} />
          <span>Ask a Question</span>
        </button>
        <button onClick={() => navigate('/datasets')}>
          <Upload size={16} />
          <span>Upload Data</span>
        </button>
        <button onClick={() => navigate('/connections')}>
          <Plug size={16} />
          <span>Add Connection</span>
        </button>
      </div>

      {/* Pinned charts grid */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Pinned Charts</span>
        </div>
        {pinnedCharts.length === 0 ? (
          <div className="empty-state">
            <BarChart3 size={40} strokeWidth={1.5} />
            <h3>No charts pinned yet</h3>
            <p>Ask questions in the AI Chat and click &quot;Add to Dashboard&quot; on any chart to pin it here.</p>
            <button className="open-chat-btn" onClick={() => setPanelState('docked')}>
              Open AI Chat
            </button>
          </div>
        ) : (
          <div className="pinned-grid">
            {pinnedCharts.map((chart) => (
              <div key={chart.id} className="pinned-card">
                <div className="pinned-card-header">
                  <span className="pinned-card-title">{chart.title}</span>
                  <div className="pinned-card-actions">
                    <button onClick={() => handleSaveChart(chart.imageUrl, chart.title)} title="Save">
                      <Download size={14} />
                    </button>
                    <button onClick={() => window.open(chart.imageUrl, '_blank')} title="Expand">
                      <Expand size={14} />
                    </button>
                    <button onClick={() => unpinChart(chart.id)} title="Remove">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <img src={chart.imageUrl} alt={chart.title} className="pinned-card-img" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      {recentMessages.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Recent Activity</span>
          </div>
          <div className="activity-list">
            {recentMessages.map((msg) => (
              <div key={msg.id} className="activity-item">
                <span className="activity-role">{msg.role === 'user' ? 'You' : 'AI'}</span>
                <span className="activity-text">
                  {msg.role === 'user'
                    ? msg.content
                    : msg.blocks?.[0]?.type === 'text'
                      ? (msg.blocks[0].content || '').slice(0, 120) + ((msg.blocks[0].content?.length || 0) > 120 ? '…' : '')
                      : `${msg.blocks?.length || 0} response block(s)`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}
