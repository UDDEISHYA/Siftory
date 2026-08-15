import { useState, useCallback } from 'react';
import { Search, Upload, Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useDatasetStore } from '../stores/datasetStore';
import { fetchProfile, uploadDataset } from '../api/client';
import type { ProfileColumn } from '../api/client';
import './DatasetsPage.css';

export default function DatasetsPage() {
  const { datasets, activeDataset, activeSource, load, select, remove } = useDatasetStore();
  const [search, setSearch] = useState('');
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileColumn[]>>({});
  const [loadingProfile, setLoadingProfile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const filtered = datasets.filter((d) =>
    d.table_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleExpand = async (tableName: string, source: string) => {
    if (expandedTable === tableName) {
      setExpandedTable(null);
      return;
    }
    setExpandedTable(tableName);
    if (!profiles[tableName]) {
      setLoadingProfile(tableName);
      try {
        const profile = await fetchProfile(tableName, source);
        if (profile.tables[0]) {
          setProfiles((p) => ({ ...p, [tableName]: profile.tables[0].columns }));
        }
      } catch {
        // silently fail
      }
      setLoadingProfile(null);
    }
  };

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }
    setUploading(true);
    try {
      await uploadDataset(file);
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
    setUploading(false);
  }, [load]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await remove(name);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="datasets-page">
      <div className="datasets-header">
        <div>
          <h1>Datasets</h1>
          <p className="datasets-subtitle">{datasets.length} tables available</p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        className={`upload-zone ${dragOver ? 'dragover' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload size={20} />
        <span>{uploading ? 'Uploading...' : 'Drop CSV here or'}</span>
        <label className="upload-browse">
          browse
          <input
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* Search */}
      <div className="datasets-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search tables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table grid */}
      <div className="datasets-table-wrap">
        <table className="datasets-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>Name</th>
              <th>Source</th>
              <th>Rows</th>
              <th>Columns</th>
              <th>Active</th>
              <th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ds) => {
              const isActive = activeDataset === ds.table_name && activeSource === ds.source;
              const isExpanded = expandedTable === ds.table_name;
              const isDemo = ds.source === 'novamart_demo';
              const isRemote = ds.source.startsWith('conn:');
              return (
                <DatasetRowGroup
                  key={`${ds.source}-${ds.table_name}`}
                  ds={ds}
                  isActive={isActive}
                  isExpanded={isExpanded}
                  isDemo={isDemo}
                  isRemote={isRemote}
                  profileCols={profiles[ds.table_name]}
                  loadingProfile={loadingProfile === ds.table_name}
                  onExpand={() => handleExpand(ds.table_name, ds.source)}
                  onSelect={() => select(ds.table_name, ds.source)}
                  onDelete={() => handleDelete(ds.table_name)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DatasetRowGroup({
  ds,
  isActive,
  isExpanded,
  isDemo,
  isRemote,
  profileCols,
  loadingProfile,
  onExpand,
  onSelect,
  onDelete,
}: {
  ds: { table_name: string; source: string; row_count: number; column_count: number };
  isActive: boolean;
  isExpanded: boolean;
  isDemo: boolean;
  isRemote: boolean;
  profileCols?: ProfileColumn[];
  loadingProfile: boolean;
  onExpand: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const sourceBadge = () => {
    if (isRemote) {
      const connName = ds.source.replace(/^conn:/, '');
      return <span className="source-badge remote">{connName}</span>;
    }
    if (isDemo) {
      return <span className="source-badge demo">demo</span>;
    }
    return <span className="source-badge upload">upload</span>;
  };

  return (
    <>
      <tr className={`dataset-row ${isActive ? 'active-row' : ''}`}>
        <td>
          <button className="expand-btn" onClick={onExpand}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="ds-name" onClick={onSelect} style={{ cursor: 'pointer' }}>
          {ds.table_name}
        </td>
        <td>
          {sourceBadge()}
        </td>
        <td>{ds.row_count.toLocaleString()}</td>
        <td>{ds.column_count}</td>
        <td>
          {isActive ? (
            <span className="active-badge"><Check size={12} /> Active</span>
          ) : (
            <button className="select-btn" onClick={onSelect}>Select</button>
          )}
        </td>
        <td>
          {!isDemo && !isRemote && (
            <button className="delete-btn" onClick={onDelete} title="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="profile-row">
          <td colSpan={7}>
            <div className="profile-expand">
              {loadingProfile ? (
                <div className="profile-loading">Loading schema...</div>
              ) : profileCols ? (
                <table className="schema-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Type</th>
                      <th>Nulls %</th>
                      <th>Unique</th>
                      <th>Range / Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileCols.map((col) => (
                      <tr key={col.name}>
                        <td className="col-name">{col.name}</td>
                        <td className="col-type">{col.type}</td>
                        <td>
                          <NullBar pct={col.null_pct} />
                        </td>
                        <td>{(col.n_unique || 0).toLocaleString()}</td>
                        <td className="col-range">
                          {col.min_val != null && col.max_val != null
                            ? `${col.min_val} → ${col.max_val}`
                            : (col.sample_values || []).slice(0, 3).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="profile-loading">No profile available</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NullBar({ pct }: { pct: number }) {
  const cls = pct === 0 ? 'null-ok' : pct > 5 ? 'null-bad' : 'null-warn';
  return (
    <span className="null-bar-cell">
      <span className="null-bar">
        <span className={`null-bar-fill ${cls}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </span>
      <span className="null-pct">{pct}%</span>
    </span>
  );
}
