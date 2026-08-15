import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import './ModelsPage.css';

/* ── Inline SVG logos ──────────────────────────────────── */

function ClaudeLogo({ size = 48 }: { size?: number }) {
  // Official Anthropic Claude starburst mark – 12 tapered rays
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g fill="#D97757">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
          <polygon
            key={angle}
            points="49.5,46 46,17 46.5,9 48.5,5 51.5,5 53.5,9 54,17 50.5,46"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
      </g>
    </svg>
  );
}

function OpenAILogo({ size = 48 }: { size?: number }) {
  // Official OpenAI hexagonal knot mark
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A5.985 5.985 0 0 0 10.756.5a6.056 6.056 0 0 0-5.772 4.206 5.99 5.99 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.91 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.244 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.998-2.9 6.056 6.056 0 0 0-.748-7.073h.016zM13.244 22.428a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.675v-6.738l2.026 1.17a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.5 4.487zM3.584 18.293a4.471 4.471 0 0 1-.535-3.014l.142.086 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062l-4.83 2.795a4.504 4.504 0 0 1-6.15-1.65zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071.006L3.987 14.02a4.504 4.504 0 0 1-1.646-6.123zm16.597 3.855l-5.833-3.387L15.124 7.2a.076.076 0 0 1 .071-.006l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.411-.66zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66v.018zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.759a.795.795 0 0 0-.393.675v6.727zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.606 1.5-2.602-1.5v-3z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── Model Card Component ──────────────────────────────── */

interface ModelCardProps {
  provider: 'anthropic' | 'openai';
  title: string;
  subtitle: string;
  modelName: string;
  logo: React.ReactNode;
  isActive: boolean;
  isConfigured: boolean;
  onToggle: () => void;
  onSaveKey: (key: string) => Promise<void>;
}

function ModelCard({
  provider,
  title,
  subtitle,
  modelName,
  logo,
  isActive,
  isConfigured,
  onToggle,
  onSaveKey,
}: ModelCardProps) {
  const [keyValue, setKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSave = async () => {
    if (!keyValue.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveKey(keyValue.trim());
      setFeedback({ type: 'success', msg: 'Key saved successfully' });
      setKeyValue('');
      setShowKey(false);
    } catch (e: any) {
      setFeedback({ type: 'error', msg: e.message || 'Failed to save key' });
    }
    setSaving(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className={`model-card ${isActive ? 'active' : ''}`}>
      <div className="model-card-header">
        <div className="model-logo">{logo}</div>
        <div className="model-info">
          <div className="model-title">{title}</div>
          <div className="model-subtitle">{subtitle}</div>
        </div>
        <div className="model-toggle">
          <button
            className={`model-toggle-btn ${isActive ? 'active' : ''}`}
            onClick={onToggle}
            title={isActive ? `${title} is active` : `Switch to ${title}`}
            aria-label={isActive ? `${title} is active` : `Switch to ${title}`}
          />
        </div>
      </div>

      <div className="model-card-body">
        <div className="model-name-row">
          <span className="model-name-badge">{modelName}</span>
        </div>

        <div className="model-key-group">
          <label className="model-key-label" htmlFor={`key-${provider}`}>
            API Key
          </label>
          <div className="model-key-input-row">
            <div className="model-key-input-wrap">
              <input
                id={`key-${provider}`}
                className="model-key-input"
                type={showKey ? 'text' : 'password'}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder={isConfigured ? '••••••••••••••••' : `Enter ${title} API key`}
                autoComplete="off"
              />
              <button
                className="model-key-eye-btn"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide key' : 'Show key'}
                aria-label={showKey ? 'Hide key' : 'Show key'}
                type="button"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              className="model-save-btn"
              onClick={handleSave}
              disabled={saving || !keyValue.trim()}
            >
              {saving ? <Loader2 size={14} className="spin" /> : null}
              Save Key
            </button>
          </div>
          {feedback && (
            <div className={`model-save-feedback ${feedback.type}`}>
              {feedback.msg}
            </div>
          )}
        </div>

        <div className="model-status">
          <span className={`model-status-dot ${isConfigured ? 'configured' : 'not-configured'}`} />
          <span className={`model-status-text ${isConfigured ? 'configured' : ''}`}>
            {isConfigured ? 'Configured' : 'Not configured'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────── */

export default function ModelsPage() {
  const {
    activeProvider,
    anthropicConfigured,
    openaiConfigured,
    loading,
    loadStatus,
    setActiveProvider,
    saveApiKey,
  } = useModelStore();

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Models</h1>
          <p className="page-subtitle">Configure your LLM providers</p>
        </div>
        <div className="empty-state">
          <Loader2 size={32} className="spin" />
          <p>Loading model configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header models-header">
        <div>
          <h1 className="page-title">Models</h1>
          <p className="page-subtitle">Configure your LLM providers</p>
        </div>
      </div>

      <div className="models-grid">
        <ModelCard
          provider="anthropic"
          title="Claude"
          subtitle="by Anthropic"
          modelName="claude-sonnet-4-20250514"
          logo={<ClaudeLogo size={48} />}
          isActive={activeProvider === 'anthropic'}
          isConfigured={anthropicConfigured}
          onToggle={() => setActiveProvider('anthropic')}
          onSaveKey={(key) => saveApiKey('anthropic', key)}
        />
        <ModelCard
          provider="openai"
          title="GPT"
          subtitle="by OpenAI"
          modelName="gpt-4o"
          logo={<OpenAILogo size={48} />}
          isActive={activeProvider === 'openai'}
          isConfigured={openaiConfigured}
          onToggle={() => setActiveProvider('openai')}
          onSaveKey={(key) => saveApiKey('openai', key)}
        />
      </div>
    </div>
  );
}
