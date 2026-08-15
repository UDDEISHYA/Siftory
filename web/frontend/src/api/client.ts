export interface DatasetInfo {
  table_name: string;
  source: string;
  row_count: number;
  column_count: number;
  columns: { name: string; type: string }[];
}

export interface ProfileColumn {
  name: string;
  type: string;
  null_pct: number;
  n_unique: number;
  min_val: string | number | null;
  max_val: string | number | null;
  sample_values: string[];
}

export interface ProfileResponse {
  dataset: string;
  tables: {
    table_name: string;
    row_count: number;
    columns: ProfileColumn[];
  }[];
  quality: {
    grade: string;
    issues: { message: string; severity: string }[];
  };
}

export interface ChatBlock {
  type: 'text' | 'table' | 'chart' | 'error' | 'thinking' | 'tool_call';
  content?: string;
  columns?: string[];
  rows?: (string | number | null)[][];
  row_count?: number;
  execution_ms?: number;
  sql?: string;
  filename?: string;
  title?: string;
  // Transparent chat fields:
  step?: number;
  tool?: string;
  input?: Record<string, unknown>;
  result_summary?: string;
  has_error?: boolean;
}

export interface ChatResponse {
  session_id: string;
  blocks: ChatBlock[];
  pipeline?: boolean;
  run_id?: string;
  agents?: string[];
}

export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const res = await fetch('/api/datasets');
  if (!res.ok) throw new Error('Failed to load datasets');
  const data = await res.json();
  return data.datasets || [];
}

export async function fetchDatasetDetail(name: string, source: string) {
  const res = await fetch(`/api/datasets/${name}?source=${source}`);
  if (!res.ok) throw new Error('Failed to load dataset detail');
  return res.json();
}

export async function fetchProfile(name: string, source: string): Promise<ProfileResponse> {
  const res = await fetch(`/api/datasets/${name}/profile?source=${source}`);
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

export async function uploadDataset(file: File): Promise<DatasetInfo> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/datasets/upload', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function deleteDataset(name: string) {
  const res = await fetch(`/api/datasets/${name}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Delete failed');
  }
  return res.json();
}

export async function sendChat(
  message: string,
  source: string,
  sessionId: string
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, source, session_id: sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export async function sendAnalyzerChat(
  message: string,
  sources: string[],
  sessionId: string
): Promise<ChatResponse> {
  const res = await fetch('/api/analyzer/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sources, session_id: sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export function chartUrl(filename: string): string {
  return `/api/charts/${filename}`;
}

// ── Connections ──

export interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
  secret?: boolean;
}

export interface ProviderInfo {
  id: string;
  display_name: string;
  fields: ProviderField[];
  connected: boolean;
}

export interface ConnectionInfo {
  id: string;
  provider: string;
  display_name: string;
  connected: boolean;
  tables_count: number;
  category?: string;
}

export async function fetchProviders(): Promise<ProviderInfo[]> {
  const res = await fetch('/api/connections/providers');
  if (!res.ok) throw new Error('Failed to load providers');
  const data = await res.json();
  // Map backend field shape (secret: boolean) to frontend shape (type: 'text' | 'password')
  return (data.providers || []).map((p: any) => ({
    ...p,
    fields: (p.fields || []).map((f: any) => ({
      ...f,
      type: f.type || (f.secret ? 'password' : 'text'),
    })),
  }));
}

export async function fetchConnections(): Promise<ConnectionInfo[]> {
  const res = await fetch('/api/connections');
  if (!res.ok) throw new Error('Failed to load connections');
  const data = await res.json();
  return data.connections || [];
}

export async function createConnection(
  connectionId: string, provider: string, displayName: string, credentials: Record<string, string>
): Promise<any> {
  const res = await fetch('/api/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection_id: connectionId, provider, display_name: displayName, credentials }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create connection');
  }
  return res.json();
}

export async function testConnection(connectionId: string): Promise<{ ok: boolean; message: string; tables?: string[] }> {
  const res = await fetch(`/api/connections/${connectionId}/test`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Test failed');
  }
  return res.json();
}

export async function deleteConnection(connectionId: string): Promise<void> {
  const res = await fetch(`/api/connections/${connectionId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Delete failed');
  }
}

export async function fetchConnectionTables(connectionId: string): Promise<any[]> {
  const res = await fetch(`/api/connections/${connectionId}/tables`);
  if (!res.ok) throw new Error('Failed to load tables');
  const data = await res.json();
  return data.tables || [];
}

// ── Connection Detail ──

export interface ConnectionDetail {
  id: string;
  provider: string;
  display_name: string;
  connected: boolean;
  health_message: string;
  tables_count: number;
  tables: string[];
}

export async function fetchConnectionDetail(connectionId: string): Promise<ConnectionDetail> {
  const res = await fetch(`/api/connections/${connectionId}/detail`);
  if (!res.ok) throw new Error('Failed to load connection detail');
  return res.json();
}

// ── Notion Exports ──

export interface NotionExport {
  id: string;
  type: string;
  question?: string;
  page_title?: string;
  findings?: { content?: string }[];
  charts?: { title?: string }[];
  sql_queries?: string[];
  created_at: string;
  status: string;
  notion_url?: string;
}

export async function fetchNotionExports(): Promise<NotionExport[]> {
  const res = await fetch('/api/export/notion/exports');
  if (!res.ok) throw new Error('Failed to load exports');
  const data = await res.json();
  return data.exports || [];
}

// ── Pipeline Runs ──

export interface PipelineRunSummary {
  run_id: string;
  question: string;
  status: string;
  agents: string[];
  completed_agents: string[];
  findings_count: number;
  charts_count: number;
}

export async function fetchPipelineRuns(): Promise<PipelineRunSummary[]> {
  const res = await fetch('/api/pipeline/runs');
  if (!res.ok) throw new Error('Failed to load runs');
  const data = await res.json();
  return data.runs || [];
}
