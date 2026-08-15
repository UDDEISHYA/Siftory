import { useLocation } from 'react-router-dom';
import { Database, MessageSquare } from 'lucide-react';
import { useDatasetStore } from '../stores/datasetStore';
import { useChatStore } from '../stores/chatStore';
import './TopBar.css';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/datasets': 'Datasets',
  '/reports': 'Reports',
  '/connections': 'Connections',
  '/master-analyzer': 'Master Analyzer',
  '/models': 'Models',
};

export default function TopBar() {
  const activeDataset = useDatasetStore((s) => s.activeDataset);
  const panelState = useChatStore((s) => s.panelState);
  const setPanelState = useChatStore((s) => s.setPanelState);
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" fill="#0AE7B1" opacity="0.9" />
            <path d="M12 6l-4 2.5v5L12 16l4-2.5v-5L12 6z" fill="#fff" opacity="0.3" />
          </svg>
        </span>
        <span className="topbar-title">Siftory</span>
        <div className="topbar-breadcrumb">
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{pageTitle}</span>
        </div>
      </div>
      <div className="topbar-right">
        {activeDataset && (
          <span className="topbar-dataset">
            <Database size={13} />
            {activeDataset}
          </span>
        )}
        <button
          className={`topbar-chat-btn ${panelState !== 'closed' ? 'active' : ''}`}
          onClick={() => setPanelState(panelState === 'closed' ? 'docked' : 'closed')}
          title="Toggle AI Chat"
        >
          <MessageSquare size={16} />
          <span>AI Chat</span>
        </button>
      </div>
    </header>
  );
}
