import { useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import ConnectionModal from './ConnectionModal';
import { useChatStore } from '../stores/chatStore';
import './AppShell.css';

export default function AppShell() {
  const panelState = useChatStore((s) => s.panelState);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  const handleUploadClick = () => {
    navigate('/datasets');
  };

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        <Sidebar onUploadClick={handleUploadClick} />
        <main className={`main-content ${panelState !== 'closed' ? 'with-chat' : ''}`}>
          <Outlet />
        </main>
        <ChatPanel />
      </div>
      <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} />
      {showConnectionModal && (
        <ConnectionModal onClose={() => setShowConnectionModal(false)} />
      )}
    </div>
  );
}
