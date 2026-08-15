import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { SnowflakeLogo, DatabricksLogo, PostgresLogo } from './ProviderLogos';
import { useConnectionStore } from '../stores/connectionStore';
import type { ProviderInfo } from '../api/client';
import './ConnectionModal.css';

interface ConnectionModalProps {
  onClose: () => void;
}

const PROVIDER_LOGOS: Record<string, React.FC<{ size?: number }>> = {
  snowflake: SnowflakeLogo,
  databricks: DatabricksLogo,
  postgres: PostgresLogo,
};

export default function ConnectionModal({ onClose }: ConnectionModalProps) {
  const { providers, loadProviders, createConnection, testConnection } = useConnectionStore();

  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; tables?: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (providers.length === 0) {
      loadProviders();
    }
  }, [providers.length, loadProviders]);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setConnectionId(slugify(value));
  };

  const handleSelectProvider = (provider: ProviderInfo) => {
    setSelectedProvider(provider);
    setCredentials({});
    setTestResult(null);
    setError(null);
  };

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleTest = async () => {
    if (!selectedProvider || !connectionId) return;
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      // Create a temporary connection first so test has something to hit
      await createConnection(connectionId, selectedProvider.id, displayName, credentials);
      const result = await testConnection(connectionId);
      setTestResult(result);
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!selectedProvider || !connectionId || !testResult?.ok) return;
    setSaving(true);
    setError(null);
    try {
      // Connection was already created during test; just close
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(false);
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const allRequiredFilled =
    selectedProvider &&
    displayName.trim() &&
    connectionId.trim() &&
    selectedProvider.fields
      .filter((f) => f.required)
      .every((f) => credentials[f.key]?.trim());

  return (
    <div className="connection-modal-overlay" onClick={onClose}>
      <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="connection-modal-header">
          <h2>Add Connection</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Provider selector */}
        <div className="provider-cards">
          {providers.map((p) => {
            const Logo = PROVIDER_LOGOS[p.id];
            return (
              <button
                key={p.id}
                className={`provider-card ${selectedProvider?.id === p.id ? 'selected' : ''}`}
                onClick={() => handleSelectProvider(p)}
              >
                {Logo ? <Logo size={36} /> : <span style={{ fontSize: 24 }}>⬡</span>}
                <span className="provider-label">{p.display_name}</span>
              </button>
            );
          })}
        </div>

        {selectedProvider && (
          <>
            {/* Connection identity */}
            <div className="credential-fields">
              <div className="credential-field">
                <label>Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  placeholder="e.g. Production Snowflake"
                />
              </div>
              <div className="credential-field">
                <label>Connection ID</label>
                <input
                  type="text"
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  placeholder="auto-generated from name"
                />
              </div>

              {/* Dynamic credential fields */}
              {selectedProvider.fields.map((field) => (
                <div key={field.key} className="credential-field">
                  <label>
                    {field.label}
                    {field.required && <span className="required-mark"> *</span>}
                  </label>
                  <input
                    type={field.type}
                    value={credentials[field.key] || ''}
                    onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                    placeholder={field.label}
                    autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                  />
                </div>
              ))}
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`test-result ${testResult.ok ? 'success' : 'error'}`}>
                {testResult.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <span>
                  {testResult.message}
                  {testResult.ok && testResult.tables && (
                    <> &mdash; {testResult.tables.length} table{testResult.tables.length !== 1 ? 's' : ''} found</>
                  )}
                </span>
              </div>
            )}

            {error && (
              <div className="test-result error">
                <XCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="modal-actions">
              <button
                className="modal-btn secondary"
                onClick={handleTest}
                disabled={!allRequiredFilled || testing}
              >
                {testing ? <Loader2 size={14} className="spinner" /> : null}
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                className="modal-btn primary"
                onClick={handleSave}
                disabled={!testResult?.ok || saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
