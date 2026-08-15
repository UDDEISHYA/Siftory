import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Trash2, Plug, Loader2 } from 'lucide-react';
import { useConnectionStore } from '../stores/connectionStore';
import { SnowflakeLogo, DatabricksLogo, PostgresLogo } from '../components/ProviderLogos';
import ConnectionModal from '../components/ConnectionModal';
import type { ConnectionDetail } from '../api/client';
import './ConnectionsPage.css';

const PROVIDER_LOGOS: Record<string, React.FC<{ size?: number }>> = {
  snowflake: SnowflakeLogo,
  databricks: DatabricksLogo,
  postgres: PostgresLogo,
};

export default function ConnectionsPage() {
  const { connections, connectionDetails, loadConnectionDetail, deleteConnection, testConnection, loadConnections } = useConnectionStore();
  const [showModal, setShowModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const dataConnections = connections.filter((c) => c.category !== 'integration');
  const integrations = connections.filter((c) => c.category === 'integration');

  // Load details for each connection on mount
  useEffect(() => {
    dataConnections.forEach((conn) => {
      if (!connectionDetails[conn.id]) {
        loadConnectionDetail(conn.id);
      }
    });
  }, [dataConnections.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const healthyCount = dataConnections.filter((conn) => {
    const detail = connectionDetails[conn.id];
    return detail?.connected;
  }).length;

  const totalTables = dataConnections.reduce((sum, conn) => {
    const detail = connectionDetails[conn.id];
    return sum + (detail?.tables_count || 0);
  }, 0);

  const uniqueProviders = new Set(dataConnections.map((c) => c.provider)).size;

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await testConnection(id);
      await loadConnectionDetail(id);
    } catch {
      // error handled by store
    }
    setTestingId(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete connection "${name}"? This cannot be undone.`)) return;
    await deleteConnection(id);
  };

  const handleModalClose = () => {
    setShowModal(false);
    loadConnections();
  };

  return (
    <div className="page">
      <div className="page-header connections-header">
        <div>
          <h1 className="page-title">Connections</h1>
          <p className="page-subtitle">Manage your database connections</p>
        </div>
        <button className="add-conn-btn" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          <span>Add Connection</span>
        </button>
      </div>

      {/* Metric cards */}
      <div className="connections-metrics">
        <div className="metric-card">
          <div className="metric-label">Total Connections</div>
          <div className="metric-value">{dataConnections.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Healthy</div>
          <div className="metric-value" style={{ color: healthyCount > 0 ? 'var(--success)' : undefined }}>
            {healthyCount}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Tables</div>
          <div className="metric-value">{totalTables}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Providers</div>
          <div className="metric-value">{uniqueProviders}</div>
        </div>
      </div>

      {/* Connections grid */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Data Sources</span>
        </div>
        {dataConnections.length === 0 ? (
          <div className="empty-state">
            <Plug size={40} strokeWidth={1.5} />
            <h3>No connections yet</h3>
            <p>Connect to Snowflake, Databricks, or PostgreSQL to query your data directly.</p>
            <button className="add-conn-btn" onClick={() => setShowModal(true)}>
              <Plus size={16} />
              <span>Add Connection</span>
            </button>
          </div>
        ) : (
          <div className="connections-grid">
            {dataConnections.map((conn) => {
              const detail: ConnectionDetail | undefined = connectionDetails[conn.id];
              const Logo = PROVIDER_LOGOS[conn.provider];
              return (
                <div key={conn.id} className="connection-card card">
                  <div className="conn-card-header">
                    <div className="conn-card-logo">
                      {Logo ? <Logo size={32} /> : <Plug size={24} />}
                    </div>
                    <div className="conn-card-info">
                      <div className="conn-card-name">{conn.display_name}</div>
                      <div className="conn-card-provider">{conn.provider}</div>
                    </div>
                    <span className={`status-pill ${detail ? (detail.connected ? 'healthy' : 'error') : 'inactive'}`}>
                      {detail ? (detail.connected ? 'Healthy' : 'Error') : 'Unknown'}
                    </span>
                  </div>
                  <div className="conn-card-body">
                    <div className="conn-card-stats">
                      <div className="conn-stat">
                        <span className="conn-stat-value">{detail?.tables_count ?? '—'}</span>
                        <span className="conn-stat-label">Tables</span>
                      </div>
                      <div className="conn-stat">
                        <span className="conn-stat-value">{conn.id}</span>
                        <span className="conn-stat-label">Connection ID</span>
                      </div>
                    </div>
                    {detail?.health_message && !detail.connected && (
                      <div className="conn-card-error">{detail.health_message}</div>
                    )}
                  </div>
                  <div className="conn-card-actions">
                    <button
                      className="conn-action-btn"
                      onClick={() => handleTest(conn.id)}
                      disabled={testingId === conn.id}
                    >
                      {testingId === conn.id ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                      <span>{testingId === conn.id ? 'Testing...' : 'Test'}</span>
                    </button>
                    <button
                      className="conn-action-btn danger"
                      onClick={() => handleDelete(conn.id, conn.display_name)}
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integrations */}
      {integrations.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Integrations</span>
          </div>
          <div className="connections-grid">
            {integrations.map((conn) => (
              <div key={conn.id} className="connection-card card">
                <div className="conn-card-header">
                  <div className="conn-card-logo">
                    <span style={{ fontSize: 24 }}>📝</span>
                  </div>
                  <div className="conn-card-info">
                    <div className="conn-card-name">{conn.display_name}</div>
                    <div className="conn-card-provider">Export Integration</div>
                  </div>
                  <span className={`status-pill ${conn.connected ? 'healthy' : 'inactive'}`}>
                    {conn.connected ? 'Connected' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && <ConnectionModal onClose={handleModalClose} />}
    </div>
  );
}
