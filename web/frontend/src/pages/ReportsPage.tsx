import { useState, useEffect, useMemo } from 'react';
import { BookOpen, ExternalLink, Search, BarChart3, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchNotionExports, type NotionExport } from '../api/client';
import './ReportsPage.css';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '...';
}

type StatusFilter = 'all' | 'exported' | 'pending_mcp';

export default function ReportsPage() {
  const [exports, setExports] = useState<NotionExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotionExports()
      .then(setExports)
      .catch(() => setExports([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let items = exports;

    if (statusFilter !== 'all') {
      items = items.filter((e) => e.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          (e.page_title || '').toLowerCase().includes(q) ||
          (e.question || '').toLowerCase().includes(q) ||
          (e.findings || []).some((f) => (f.content || '').toLowerCase().includes(q))
      );
    }

    return items;
  }, [exports, search, statusFilter]);

  const getTitle = (e: NotionExport): string => {
    return e.page_title || e.question || 'Untitled Analysis';
  };

  const getDescription = (e: NotionExport): string | null => {
    if (e.findings && e.findings.length > 0 && e.findings[0].content) {
      return truncate(e.findings[0].content, 120);
    }
    return null;
  };

  const getFindingsCount = (e: NotionExport): number => {
    return e.findings?.length || 0;
  };

  const getChartsCount = (e: NotionExport): number => {
    return e.charts?.length || 0;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Analyses exported to Notion</p>
        </div>
      </div>

      {/* Search and filter bar */}
      <div className="reports-toolbar">
        <div className="reports-search-wrapper">
          <Search size={16} className="reports-search-icon" />
          <input
            type="text"
            className="reports-search-input"
            placeholder="Find a report..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="reports-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All statuses</option>
          <option value="exported">Exported</option>
          <option value="pending_mcp">Pending</option>
        </select>
      </div>

      {/* Card list */}
      {loading ? (
        <div className="reports-loading">Loading reports...</div>
      ) : filtered.length === 0 && exports.length === 0 ? (
        <div className="reports-empty-state">
          <BookOpen size={48} strokeWidth={1.2} className="reports-empty-icon" />
          <h3 className="reports-empty-title">No analyses exported yet</h3>
          <p className="reports-empty-text">
            Use the Master Analyzer to run analyses, then export them to Notion.
          </p>
          <button
            className="reports-empty-btn"
            onClick={() => navigate('/master-analyzer')}
          >
            Open Master Analyzer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="reports-empty-state">
          <Search size={48} strokeWidth={1.2} className="reports-empty-icon" />
          <h3 className="reports-empty-title">No matching reports</h3>
          <p className="reports-empty-text">
            Try adjusting your search or filter.
          </p>
        </div>
      ) : (
        <div className="reports-card-list">
          {filtered.map((item) => {
            const title = getTitle(item);
            const description = getDescription(item);
            const findingsCount = getFindingsCount(item);
            const chartsCount = getChartsCount(item);
            const canOpenNotion =
              item.status === 'exported' && item.notion_url;

            return (
              <div key={item.id} className="reports-card">
                <div className="reports-card-main">
                  <div className="reports-card-title-row">
                    <BookOpen
                      size={16}
                      strokeWidth={1.5}
                      className="reports-card-icon"
                    />
                    <span className="reports-card-title">
                      {truncate(title, 80)}
                    </span>
                  </div>
                  {description && (
                    <p className="reports-card-description">{description}</p>
                  )}
                  <div className="reports-card-meta">
                    <span className="reports-card-time">
                      {timeAgo(item.created_at)}
                    </span>
                    <span
                      className={`status-pill ${
                        item.status === 'exported' ? 'healthy' : 'inactive'
                      }`}
                    >
                      {item.status === 'exported' ? 'Exported' : 'Pending'}
                    </span>
                    {findingsCount > 0 && (
                      <span className="reports-card-stat">
                        <FileText size={12} />
                        {findingsCount} finding{findingsCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {chartsCount > 0 && (
                      <span className="reports-card-stat">
                        <BarChart3 size={12} />
                        {chartsCount} chart{chartsCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {canOpenNotion && (
                  <a
                    href={item.notion_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="reports-card-link"
                    title="Open in Notion"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
