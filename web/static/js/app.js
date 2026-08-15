const App = {
  activeDataset: null,
  activeSource: null,
  datasets: [],

  async init() {
    await this.loadDatasets();
    this.bindEvents();
  },

  async loadDatasets() {
    try {
      const res = await fetch('/api/datasets');
      const data = await res.json();
      this.datasets = data.datasets || [];
      this.renderDatasetList();
    } catch (e) {
      document.getElementById('datasetList').innerHTML =
        '<div class="empty-state">Failed to load datasets</div>';
    }
  },

  renderDatasetList() {
    const list = document.getElementById('datasetList');
    if (this.datasets.length === 0) {
      list.innerHTML = '<div class="empty-state">No datasets yet. Upload a CSV to begin.</div>';
      return;
    }

    const grouped = {};
    for (const ds of this.datasets) {
      const src = ds.source || 'upload';
      if (!grouped[src]) grouped[src] = [];
      grouped[src].push(ds);
    }

    let html = '';
    for (const [source, items] of Object.entries(grouped)) {
      for (const ds of items) {
        const isActive = this.activeDataset === ds.table_name && this.activeSource === source;
        const badge = source === 'novamart_demo'
          ? '<span class="dataset-badge badge-demo">demo</span>'
          : '<span class="dataset-badge badge-upload">upload</span>';
        const canDelete = source !== 'novamart_demo';
        const deleteBtn = canDelete
          ? `<button class="dataset-delete" data-delete-table="${ds.table_name}" title="Delete dataset">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>`
          : '';
        html += `
          <div class="dataset-item${isActive ? ' active' : ''}"
               data-table="${ds.table_name}" data-source="${source}">
            <div class="dataset-item-content">
              <div class="dataset-item-name">${ds.table_name}${badge}</div>
              <div class="dataset-item-meta">${ds.row_count.toLocaleString()} rows &middot; ${ds.column_count} cols</div>
            </div>
            ${deleteBtn}
          </div>`;
      }
    }
    list.innerHTML = html;

    list.querySelectorAll('.dataset-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.dataset-delete')) return;
        this.selectDataset(el.dataset.table, el.dataset.source);
      });
    });

    list.querySelectorAll('.dataset-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tableName = btn.dataset.deleteTable;
        this.deleteDataset(tableName);
      });
    });
  },

  async deleteDataset(tableName) {
    if (!confirm(`Delete "${tableName}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/datasets/${tableName}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Failed to delete dataset');
        return;
      }

      if (this.activeDataset === tableName) {
        this.activeDataset = null;
        this.activeSource = null;
        document.getElementById('activeDatasetLabel').textContent = 'No dataset';
        document.getElementById('chatInput').disabled = true;
        document.getElementById('chatSend').disabled = true;
        document.getElementById('chatInput').placeholder = 'Ask anything about your data...';
        document.getElementById('results').innerHTML = '';
        document.getElementById('results').classList.remove('has-content');
        document.getElementById('welcomeState').style.display = '';
      }

      await this.loadDatasets();
    } catch (e) {
      alert('Failed to delete dataset: ' + e.message);
    }
  },

  selectDataset(tableName, source) {
    this.activeDataset = tableName;
    this.activeSource = source;

    document.getElementById('activeDatasetLabel').textContent = tableName;

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('visible');

    this.renderDatasetList();

    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    chatInput.disabled = false;
    chatSend.disabled = false;
    chatInput.placeholder = `Ask anything about ${tableName}...`;

    const isNovamart = source === 'novamart_demo';
    const suggestions = document.getElementById('suggestedQueries');
    suggestions.style.display = isNovamart ? 'flex' : 'none';

    Dashboard.loadProfile(tableName, source);
  },

  bindEvents() {
    const chatInput = document.getElementById('chatInput');
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    document.getElementById('chatSend').addEventListener('click', () => {
      this.sendMessage();
    });

    document.querySelectorAll('.suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        chatInput.value = btn.dataset.q;
        chatInput.focus();
      });
    });

    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
      });
    }
  },

  async sendMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg || !this.activeDataset) return;

    input.value = '';
    input.style.height = 'auto';

    Chat.send(msg);
  },

  formatNumber(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
