const Dashboard = {
  async loadProfile(tableName, source) {
    const welcome = document.getElementById('welcomeState');
    const results = document.getElementById('results');

    welcome.style.display = 'none';
    results.innerHTML = '';
    results.classList.add('has-content');

    this.addSkeleton();

    try {
      const res = await fetch(`/api/datasets/${tableName}/profile?source=${source}`);
      if (!res.ok) throw new Error('Failed to load profile');
      const profile = await res.json();

      this.removeSkeleton();
      this.renderProfile(profile, tableName);
    } catch (e) {
      this.removeSkeleton();
      this.addCard({
        type: 'error',
        label: 'Error',
        title: 'Failed to load profile',
        body: `<p>${e.message}</p>`,
      });
    }
  },

  renderProfile(profile, tableName) {
    const table = profile.tables[0];
    if (!table) return;

    const quality = profile.quality || {};
    const gradeClass = quality.grade === 'good' ? 'quality-good'
      : quality.grade === 'fair' ? 'quality-fair' : 'quality-poor';

    this.addCard({
      type: 'stats',
      label: 'Overview',
      title: tableName,
      collapsible: true,
      startExpanded: true,
      stats: [
        { value: App.formatNumber(table.row_count), label: 'Rows' },
        { value: table.columns.length, label: 'Columns' },
        {
          value: `<span class="quality-badge ${gradeClass}">${(quality.grade || 'unknown').toUpperCase()}</span>`,
          label: 'Data Quality',
          raw: true,
        },
      ],
      quality: quality,
    });

    this.addCard({
      type: 'schema',
      label: 'Schema',
      title: `${table.columns.length} columns`,
      collapsible: true,
      startExpanded: false,
      columns: table.columns,
    });

    this.loadSampleData(tableName, profile.dataset);
  },

  async loadSampleData(tableName, source) {
    try {
      const res = await fetch(`/api/datasets/${tableName}?source=${source}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.sample_rows && data.sample_rows.length > 0) {
        this.addCard({
          type: 'table',
          label: 'Sample Data',
          title: `First ${data.sample_rows.length} rows`,
          collapsible: true,
          startExpanded: false,
          columns: Object.keys(data.sample_rows[0]),
          rows: data.sample_rows.map(r => Object.values(r)),
        });
      }
    } catch (e) {
      // Silently skip sample data on error
    }
  },

  addCard(config) {
    const results = document.getElementById('results');
    results.classList.add('has-content');
    document.getElementById('welcomeState').style.display = 'none';

    const card = document.createElement('div');
    card.className = 'result-card';

    const isCollapsible = !!config.collapsible;
    if (isCollapsible) {
      card.classList.add('collapsible');
      if (config.startExpanded) card.classList.add('expanded');
    }

    let headerHtml = '';
    if (config.label || config.title) {
      const toggleBtn = isCollapsible
        ? '<span class="card-toggle"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>'
        : '';
      headerHtml = `<div class="card-header">
        <div class="card-header-left">
          ${config.label ? `<div class="card-label">${config.label}</div>` : ''}
          ${config.title ? `<div class="card-title">${config.title}</div>` : ''}
        </div>
        ${toggleBtn}
      </div>`;
    }

    const bodyClass = config.type === 'text' ? 'card-body card-body-tall' : 'card-body';
    let bodyHtml = `<div class="${bodyClass}">`;

    if (config.type === 'stats') {
      bodyHtml += '<div class="stat-row">';
      for (const s of config.stats) {
        const val = s.raw ? s.value : `<span>${s.value}</span>`;
        bodyHtml += `<div class="stat-item">
          <div class="stat-value">${val}</div>
          <div class="stat-label">${s.label}</div>
        </div>`;
      }
      bodyHtml += '</div>';

      if (config.quality && config.quality.issues && config.quality.issues.length > 0) {
        bodyHtml += '<div class="issue-list">';
        for (const issue of config.quality.issues) {
          bodyHtml += `<div class="issue-item ${issue.severity}">
            <span class="issue-dot"></span>
            ${issue.message}
          </div>`;
        }
        bodyHtml += '</div>';
      }
    }

    else if (config.type === 'schema') {
      bodyHtml += '<div class="schema-table-wrap"><table class="schema-table">';
      bodyHtml += '<thead><tr><th>Column</th><th>Type</th><th>Nulls</th><th>Unique</th><th>Range / Samples</th></tr></thead><tbody>';
      for (const col of config.columns) {
        const nullPct = col.null_pct || 0;
        const barClass = nullPct === 0 ? 'null-ok' : nullPct > 5 ? 'null-bad' : 'null-warn';
        const barWidth = Math.max(nullPct, 2);
        const rangeOrSample = (col.min_val != null && col.max_val != null)
          ? `${col.min_val} → ${col.max_val}`
          : (col.sample_values || []).slice(0, 3).join(', ');

        bodyHtml += `<tr>
          <td class="col-name">${col.name}</td>
          <td class="col-type">${col.type}</td>
          <td>
            <span class="null-bar"><span class="null-bar-fill ${barClass}" style="width:${barWidth}%"></span></span>
            ${nullPct}%
          </td>
          <td>${(col.n_unique || 0).toLocaleString()}</td>
          <td>${rangeOrSample}</td>
        </tr>`;
      }
      bodyHtml += '</tbody></table></div>';
    }

    else if (config.type === 'table') {
      bodyHtml += '<div class="table-wrap"><table class="data-table">';
      bodyHtml += '<thead><tr>';
      for (const col of config.columns) {
        bodyHtml += `<th>${this.escapeHtml(String(col))}</th>`;
      }
      bodyHtml += '</tr></thead><tbody>';
      for (const row of (config.rows || []).slice(0, 50)) {
        bodyHtml += '<tr>';
        for (const val of row) {
          const display = val === null || val === '' ? '<span style="color:var(--text-muted)">null</span>' : this.escapeHtml(String(val));
          bodyHtml += `<td>${display}</td>`;
        }
        bodyHtml += '</tr>';
      }
      bodyHtml += '</tbody></table></div>';

      if (config.sql) {
        const sqlId = 'sql_' + Math.random().toString(36).slice(2, 8);
        bodyHtml += `
          <div style="margin-top:10px;">
            <button class="sql-toggle" onclick="document.getElementById('${sqlId}').classList.toggle('open'); this.querySelector('span').textContent = document.getElementById('${sqlId}').classList.contains('open') ? '▾' : '▸'">
              <span>▸</span> SQL
            </button>
            <div class="sql-block" id="${sqlId}">${this.escapeHtml(config.sql)}</div>
          </div>`;
      }
    }

    else if (config.type === 'chart') {
      const chartSrc = config.chartUrl || (config.filename ? `/api/charts/${config.filename}` : '');
      bodyHtml += `<img class="chart-img" src="${chartSrc}" alt="${this.escapeHtml(config.title || 'Chart')}" loading="lazy">`;
    }

    else if (config.type === 'error') {
      const errContent = config.body || `<p>${this.escapeHtml(config.content || 'Something went wrong. Try again or rephrase your question.')}</p>`;
      bodyHtml += `<div class="error-content">${errContent}</div>`;
    }

    else if (config.type === 'text') {
      const text = config.body || config.content || '';
      if (text.startsWith('<')) {
        bodyHtml += text;
      } else {
        let rendered = this.escapeHtml(text);
        rendered = rendered.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>');
        rendered = rendered.replace(/\n\n/g, '</p><p>');
        rendered = rendered.replace(/\n- /g, '</p><li>');
        rendered = rendered.replace(/&gt; (.+)/g, '<blockquote>$1</blockquote>');
        bodyHtml += `<p>${rendered}</p>`;
      }
    }

    else {
      bodyHtml += config.body || '';
    }

    bodyHtml += '</div>';

    card.innerHTML = headerHtml + bodyHtml;

    if (isCollapsible) {
      const header = card.querySelector('.card-header');
      if (header) {
        header.addEventListener('click', () => {
          card.classList.toggle('expanded');
        });
      }
    }

    results.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  addUserMessage(msg) {
    const results = document.getElementById('results');
    results.classList.add('has-content');
    document.getElementById('welcomeState').style.display = 'none';

    const el = document.createElement('div');
    el.className = 'result-card';
    el.innerHTML = `
      <div class="card-header" style="cursor:default;">
        <div class="card-header-left">
          <div class="card-label">You</div>
          <div class="card-title">${this.escapeHtml(msg)}</div>
        </div>
      </div>`;
    results.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  addSkeleton() {
    const results = document.getElementById('results');
    results.classList.add('has-content');
    const skel = document.createElement('div');
    skel.className = 'skeleton-card';
    skel.id = 'activeSkeleton';
    skel.innerHTML = `
      <div class="skeleton-line w60"></div>
      <div class="skeleton-line w80"></div>
      <div class="skeleton-line w40"></div>
      <div class="skeleton-line tall"></div>`;
    results.appendChild(skel);
    skel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  removeSkeleton() {
    const skel = document.getElementById('activeSkeleton');
    if (skel) skel.remove();
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
