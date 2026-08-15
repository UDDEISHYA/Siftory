import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Database, FileBarChart, Upload,
  ChevronLeft, ChevronRight, Plug, Brain, Cpu,
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  onUploadClick: () => void;
}

export default function Sidebar({ onUploadClick }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          {!collapsed && <span>Dashboard</span>}
        </NavLink>
        <NavLink to="/datasets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Database size={20} />
          {!collapsed && <span>Datasets</span>}
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FileBarChart size={20} />
          {!collapsed && <span>Reports</span>}
        </NavLink>
        <NavLink to="/connections" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Plug size={20} />
          {!collapsed && <span>Connections</span>}
        </NavLink>
        <NavLink to="/models" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Cpu size={20} />
          {!collapsed && <span>Models</span>}
        </NavLink>
        <NavLink to="/master-analyzer" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Brain size={20} />
          {!collapsed && <span>Master Analyzer</span>}
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item upload-btn" onClick={onUploadClick}>
          <Upload size={20} />
          {!collapsed && <span>Upload CSV</span>}
        </button>

        {/* Siftory brand logo */}
        <div className="sidebar-logo">
          <svg
            className="sidebar-logo-icon"
            viewBox="0 0 120 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Scattered data dots */}
            <circle cx="12" cy="28" r="5.5" fill="#0AE7B1" />
            <circle cx="6" cy="48" r="4" fill="#0AE7B1" />
            <circle cx="26" cy="14" r="3.5" fill="#0AE7B1" />
            <circle cx="28" cy="42" r="7" fill="#0AE7B1" />
            <circle cx="20" cy="64" r="4.5" fill="#0AE7B1" />
            <circle cx="38" cy="28" r="5" fill="#0AE7B1" />
            <circle cx="14" cy="78" r="3" fill="#0AE7B1" />
            {/* Flowing petal / starburst shapes */}
            <path d="M48 52 Q55 38, 72 32 Q86 28, 96 36 Q106 44, 90 52 Q76 58, 62 66 Q52 72, 48 52Z" fill="#0AE7B1" />
            <path d="M52 46 Q62 30, 80 22 Q96 16, 110 28 Q118 38, 98 46 Q82 50, 68 60 Q56 66, 52 46Z" fill="#0AE7B1" opacity="0.85" />
            <path d="M56 56 Q62 48, 74 44 Q84 40, 92 48 Q100 54, 86 60 Q74 66, 64 70 Q56 68, 56 56Z" fill="#0AE7B1" opacity="0.7" />
          </svg>
          {!collapsed && <span className="sidebar-logo-text">Siftory</span>}
        </div>

        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
