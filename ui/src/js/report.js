/* ═══════════════════════════════════════════════════
   VeriCore – report.js  (v2 — premium redesign)
═══════════════════════════════════════════════════ */
'use strict';

class ReportRenderer {
  constructor(app) {
    this.app = app;
  }

  render(report) {
    if (!report) return;
    const d = new Date(report.timestamp || Date.now());
    const ts = document.getElementById('report-timestamp');
    if (ts) ts.textContent = `Scanned on ${d.toLocaleDateString()} at ${d.toLocaleTimeString()}`;

    this.renderVerdict(report.verdict, report.scores);
    this.renderScores(report.scores);
    this.renderSystemIdentity(report.system_summary || {});
    this.renderComponents(report.components || {}, report.scores?.component_scores || {});
    this.renderInconsistencies(report.inconsistencies || []);
    this.renderRecommendations(report.recommendations || []);
  }

  // ── Verdict Banner ───────────────────────────────
  renderVerdict(verdict, scores) {
    const container = document.getElementById('report-verdict');
    if (!container || !verdict) return;

    const colorMap = { success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };
    const color = colorMap[verdict.color] || '#3b82f6';

    container.innerHTML = `
      <div class="verdict-banner" style="border-color: ${color}; background: ${color}18;">
        <div class="verdict-icon" style="color: ${color};">
          ${verdict.icon === 'shield' ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>` :
            verdict.icon === 'warning' ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` :
            `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`}
        </div>
        <div class="verdict-text">
          <div class="verdict-label" style="color: ${color};">${verdict.label}</div>
          <div class="verdict-detail">${verdict.detail}</div>
        </div>
      </div>
    `;
  }

  // ── Scores ───────────────────────────────────────
  renderScores(scores) {
    if (!scores) return;
    const h = scores.health_score ?? 0;
    const a = scores.authenticity_score ?? 0;

    this._setText('report-health-value', `${h}%`);
    this._setText('report-auth-value', `${a}%`);

    const hg = document.getElementById('report-health-grade');
    if (hg) {
      hg.textContent = `Grade ${scores.grade || '—'}`;
      hg.style.color = h >= 90 ? '#10b981' : h >= 70 ? '#f59e0b' : '#ef4444';
    }
    const ag = document.getElementById('report-auth-grade');
    if (ag) {
      ag.textContent = a >= 95 ? 'Hardware Verified' : a >= 75 ? 'Minor Issues' : 'Review Required';
      ag.style.color = a >= 95 ? '#10b981' : a >= 75 ? '#f59e0b' : '#ef4444';
    }
  }

  // ── System Identity ──────────────────────────────
  renderSystemIdentity(summary) {
    const el = document.getElementById('report-identity-section');
    if (!el) return;

    const rows = [
      { label: 'Manufacturer', value: summary.manufacturer },
      { label: 'Model', value: summary.model },
      { label: 'Serial Number', value: summary.serial, mono: true },
      { label: 'BIOS Version', value: summary.bios_version },
      { label: 'System UUID', value: summary.uuid, mono: true },
      { label: 'Operating System', value: summary.os },
      { label: 'Hostname', value: summary.hostname },
      { label: 'CPU', value: summary.cpu_name },
    ];

    el.innerHTML = `
      <div class="report-identity-grid">
        ${rows.map(r => `
          <div class="identity-pair">
            <div class="identity-pair-label">${r.label}</div>
            <div class="identity-pair-value ${r.mono ? 'mono' : ''}">${r.value || '—'}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Component Cards ──────────────────────────────
  renderComponents(components, compScores) {
    const el = document.getElementById('report-comp-cards');
    if (!el) return;
    el.innerHTML = '';

    const cardDefs = [
      {
        key: 'cpu', label: 'Processor', icon: this._iconCPU(),
        render: (d) => {
          const name = d.brand || d.wmi_name || 'Unknown CPU';
          const cores = d.core_count_physical ? `${d.core_count_physical}C / ${d.core_count_logical || '?'}T` : '—';
          const freq = d.hz_advertised || '—';
          return { primary: name, rows: [['Cores / Threads', cores], ['Clock Speed', freq], ['Architecture', d.architecture || '—'], ['Cache L2', d.l2_cache || '—'], ['Cache L3', d.l3_cache || '—']] };
        }
      },
      {
        key: 'memory', label: 'Memory', icon: this._iconMemory(),
        render: (d) => {
          const total = d.total_bytes ? `${(d.total_bytes / 1e9).toFixed(1)} GB` : '—';
          const slots = Array.isArray(d.slots) ? d.slots : [];
          const type = slots[0]?.memory_type || '—';
          const speed = slots[0]?.speed ? `${slots[0].speed} MT/s` : '—';
          return { primary: `${total} ${type}`, rows: [['Total Capacity', total], ['Memory Type', type], ['Speed', speed], ['Slot Count', slots.length || '—'], ['Used', d.used_percent ? `${d.used_percent.toFixed(1)}%` : '—']] };
        }
      },
      {
        key: 'storage', label: 'Storage', icon: this._iconStorage(), isArray: true,
        render: (d) => {
          const size = d.size_bytes ? `${(d.size_bytes / 1e9).toFixed(0)} GB` : '—';
          return { primary: d.model || 'Unknown Drive', rows: [['Capacity', size], ['Interface', d.interface_type || '—'], ['SMART Status', d.smart_status || '—'], ['Serial', d.serial_number || '—'], ['Firmware', d.firmware_revision || '—']] };
        }
      },
      {
        key: 'battery', label: 'Battery', icon: this._iconBattery(),
        render: (d) => {
          if (!d.present) return { primary: 'No Battery', rows: [['Status', 'Desktop system or not detected']] };
          const wear = d.wear_percent != null ? `${d.wear_percent.toFixed(1)}%` : '—';
          const design = d.design_capacity_mwh ? `${(d.design_capacity_mwh / 1000).toFixed(0)} Wh` : '—';
          const current = d.current_capacity_mwh ? `${(d.current_capacity_mwh / 1000).toFixed(0)} Wh` : '—';
          return { primary: `${d.percent ?? '—'}% · ${d.status || '—'}`, rows: [['Wear Level', wear], ['Design Capacity', design], ['Current Capacity', current], ['Cycle Count', d.cycle_count ?? '—'], ['Manufacturer', d.manufacturer || '—']] };
        }
      },
      {
        key: 'display', label: 'Display', icon: this._iconDisplay(), isArray: true,
        render: (d) => {
          const res = d.resolution_h ? `${d.resolution_h}×${d.resolution_v}` : '—';
          return { primary: d.monitor_name || d.manufacturer_name || 'Unknown Display', rows: [['Resolution', res], ['Manufacturer', d.manufacturer_name || '—'], ['Mfr ID', d.manufacturer_id || '—'], ['Product Code', d.product_code || '—'], ['Year', d.manufacture_year || '—']] };
        }
      },
      {
        key: 'gpu', label: 'Graphics', icon: this._iconGPU(), isArray: true,
        render: (d) => {
          const vram = d.vram_bytes ? `${(d.vram_bytes / 1e9).toFixed(1)} GB` : '—';
          return { primary: d.name || 'Unknown GPU', rows: [['VRAM', vram], ['Driver Version', d.driver_version || '—'], ['Driver Date', d.driver_date || '—'], ['Resolution', d.resolution || '—'], ['Refresh Rate', d.refresh_rate ? `${d.refresh_rate} Hz` : '—']] };
        }
      },
      {
        key: 'tpm', label: 'TPM Security', icon: this._iconTPM(),
        render: (d) => {
          if (!d.present) return { primary: 'Not Present', rows: [['Status', 'No TPM chip detected']] };
          return { primary: `TPM ${d.version || '?'} — ${d.manufacturer_name || '?'}`, rows: [['Version', d.version || '—'], ['Spec', d.spec_version || '—'], ['Manufacturer', d.manufacturer_name || '—'], ['Activated', d.activated ? 'Yes' : 'No'], ['Owned', d.owned ? 'Yes' : 'No']] };
        }
      },
      {
        key: 'network', label: 'Network', icon: this._iconNetwork(),
        render: (d) => {
          const adapters = d.adapters || [];
          const wifi = adapters.find(a => a.type === 'WiFi');
          return { primary: `${adapters.length} Adapters`, rows: adapters.slice(0, 4).map(a => [a.type, a.name]) };
        }
      }
    ];

    cardDefs.forEach(def => {
      const raw = components[def.key];
      if (!raw) return;
      const score = compScores[def.key];
      const items = def.isArray && Array.isArray(raw) ? raw : [raw];
      items.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const rendered = def.render(item);
        el.appendChild(this._buildCompCard(def.label + (items.length > 1 ? ` #${idx+1}` : ''), def.icon, rendered, score, item.consistency_issues));
      });
    });
  }

  _buildCompCard(label, icon, rendered, score, issues) {
    const card = document.createElement('div');
    card.className = 'rcomp-card glass';

    const scoreColor = score == null ? '#475569' : score >= 90 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';
    const scoreLabel = score == null ? '—' : score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';
    const issuesBadge = issues && issues.length > 0 ? `<span class="rcomp-issue-badge">${issues.length} issue${issues.length > 1 ? 's' : ''}</span>` : '';

    card.innerHTML = `
      <div class="rcomp-header">
        <div class="rcomp-icon">${icon}</div>
        <div class="rcomp-title-block">
          <div class="rcomp-label">${label} ${issuesBadge}</div>
          <div class="rcomp-primary">${rendered.primary || '—'}</div>
        </div>
        <div class="rcomp-score" style="color: ${scoreColor};">${score ?? '—'}<span class="rcomp-score-label">${scoreLabel}</span></div>
      </div>
      <div class="rcomp-rows">
        ${(rendered.rows || []).map(([k, v]) => `
          <div class="rcomp-row">
            <span class="rcomp-row-key">${k}</span>
            <span class="rcomp-row-val">${v ?? '—'}</span>
          </div>`).join('')}
      </div>
    `;
    return card;
  }

  // ── Inconsistencies ──────────────────────────────
  renderInconsistencies(inconsistencies) {
    const list = document.getElementById('inconsistencies-list');
    const noneMsg = document.getElementById('no-inconsistencies');
    const countEl = document.getElementById('report-issues-count');
    const countLbl = document.getElementById('report-issues-label');
    if (!list) return;

    list.innerHTML = '';
    if (countEl) countEl.textContent = inconsistencies.length;
    if (countLbl) {
      countLbl.textContent = inconsistencies.length === 0 ? 'All Clean' : `Mismatch${inconsistencies.length > 1 ? 'es' : ''} Found`;
      countLbl.style.color = inconsistencies.length === 0 ? '#10b981' : '#f59e0b';
    }

    if (!inconsistencies.length) {
      if (noneMsg) noneMsg.style.display = 'flex';
      return;
    }
    if (noneMsg) noneMsg.style.display = 'none';

    inconsistencies.forEach(inc => {
      const sev = inc.severity || 'info';
      const sevColors = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
      const color = sevColors[sev] || '#3b82f6';
      const el = document.createElement('div');
      el.className = 'inc-card';
      el.innerHTML = `
        <div class="inc-card-bar" style="background:${color};"></div>
        <div class="inc-card-body">
          <div class="inc-card-header">
            <span class="inc-sev-badge" style="color:${color};border-color:${color};">${sev.toUpperCase()}</span>
            <span class="inc-field">${inc.field}</span>
          </div>
          <p class="inc-desc">${inc.description || ''}</p>
          <div class="inc-sources">
            <div class="inc-src"><span class="inc-src-label">Source A (${inc.source_a})</span><span class="inc-src-val">${inc.value_a}</span></div>
            <div class="inc-src"><span class="inc-src-label">Source B (${inc.source_b})</span><span class="inc-src-val">${inc.value_b}</span></div>
          </div>
        </div>
      `;
      list.appendChild(el);
    });
  }

  // ── Recommendations ──────────────────────────────
  renderRecommendations(recommendations) {
    const list = document.getElementById('recommendations-list');
    if (!list) return;
    list.innerHTML = '';

    if (!recommendations || !recommendations.length) {
      list.innerHTML = '<div style="color:var(--text-muted);padding:12px;">No recommendations at this time.</div>';
      return;
    }

    const sevIcons = {
      critical: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      warning:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    };
    const sevColors = { critical: '#ef4444', warning: '#f59e0b', info: '#10b981' };

    recommendations.forEach(rec => {
      // Handle both old string format and new object format
      if (typeof rec === 'string') {
        rec = { severity: 'info', title: rec, detail: '', action: '' };
      }
      const sev = rec.severity || 'info';
      const color = sevColors[sev] || '#3b82f6';
      const icon = sevIcons[sev] || sevIcons.info;

      const el = document.createElement('div');
      el.className = 'rec-card';
      el.innerHTML = `
        <div class="rec-icon" style="color:${color};">${icon}</div>
        <div class="rec-body">
          <div class="rec-title">${rec.title}</div>
          ${rec.detail ? `<div class="rec-detail">${rec.detail}</div>` : ''}
          ${rec.action ? `<div class="rec-action">→ ${rec.action}</div>` : ''}
        </div>
        <div class="rec-sev-bar" style="background:${color};"></div>
      `;
      list.appendChild(el);
    });
  }

  // ── Icon helpers ─────────────────────────────────
  _iconCPU()     { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`; }
  _iconMemory()  { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="10" rx="1"/><line x1="6" y1="7" x2="6" y2="17"/><line x1="10" y1="7" x2="10" y2="17"/><line x1="14" y1="7" x2="14" y2="17"/><line x1="18" y1="7" x2="18" y2="17"/></svg>`; }
  _iconStorage() { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`; }
  _iconBattery() { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="7" width="18" height="10" rx="2"/><line x1="23" y1="10" x2="23" y2="14"/></svg>`; }
  _iconDisplay() { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`; }
  _iconGPU()     { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`; }
  _iconTPM()     { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`; }
  _iconNetwork() { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`; }

  _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
}
