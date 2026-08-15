const Chat = {
  sessionId: null,

  init() {
    this.sessionId = localStorage.getItem('chat_session_id');
    if (!this.sessionId) {
      this.sessionId = crypto.randomUUID();
      localStorage.setItem('chat_session_id', this.sessionId);
    }
  },

  async send(message) {
    if (!App.activeDataset) return;

    Dashboard.addUserMessage(message);
    Dashboard.addSkeleton();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          source: App.activeSource || 'upload',
          session_id: this.sessionId,
        }),
      });

      Dashboard.removeSkeleton();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Dashboard.addCard({
          type: 'error',
          label: 'Error',
          title: 'Request failed',
          body: `<p>${err.detail || res.statusText}</p>`,
        });
        return;
      }

      const data = await res.json();
      if (data.session_id) {
        this.sessionId = data.session_id;
        localStorage.setItem('chat_session_id', this.sessionId);
      }

      if (data.pipeline && data.run_id) {
        this.renderBlocks(data.blocks || []);
        Pipeline.start(data.run_id, data.agents || []);
        return;
      }

      this.renderBlocks(data.blocks || []);

    } catch (e) {
      Dashboard.removeSkeleton();
      Dashboard.addCard({
        type: 'error',
        label: 'Error',
        title: 'Connection failed',
        body: `<p>${e.message}</p>`,
      });
    }
  },

  renderBlocks(blocks) {
    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          Dashboard.addCard({
            type: 'text',
            label: 'Analysis',
            title: this.extractHeadline(block.content),
            collapsible: true,
            startExpanded: false,
            body: this.renderMarkdown(block.content),
          });
          break;

        case 'table':
          Dashboard.addCard({
            type: 'table',
            label: `Query Result — ${block.row_count.toLocaleString()} rows in ${block.execution_ms}ms`,
            title: '',
            collapsible: true,
            startExpanded: true,
            columns: block.columns,
            rows: block.rows,
            sql: block.sql,
          });
          break;

        case 'chart':
          Dashboard.addCard({
            type: 'chart',
            label: 'Chart',
            title: block.title || '',
            chartUrl: `/api/charts/${block.filename}`,
          });
          break;

        case 'error':
          Dashboard.addCard({
            type: 'error',
            label: 'Error',
            title: '',
            body: `<p>${this.escapeHtml(block.content)}</p>`,
          });
          break;
      }
    }
  },

  extractHeadline(text) {
    if (!text) return '';
    const firstLine = text.split('\n')[0].replace(/^[#*\s]+/, '').trim();
    return firstLine.length > 120 ? firstLine.substring(0, 117) + '...' : firstLine;
  },

  renderMarkdown(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n- /g, '</p><li>');
    html = html.replace(/\n(\d+)\. /g, '</p><li>');
    return `<p>${html}</p>`;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  newSession() {
    this.sessionId = crypto.randomUUID();
    localStorage.setItem('chat_session_id', this.sessionId);
  },
};

document.addEventListener('DOMContentLoaded', () => Chat.init());
