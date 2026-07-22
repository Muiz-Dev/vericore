/* ═══════════════════════════════════════════════════
   VeriCore – scan.js  (v2 — animated one-by-one reveal)
═══════════════════════════════════════════════════ */
'use strict';

class ScanController {
  constructor(app) {
    this.app = app;
    this.timer = null;
    this.startTime = 0;
    this.completedCount = 0;
    this.totalExpected = 11; // registry, smbios, bios, cpu, memory, storage, battery, display, gpu, network, tpm

    // Component display config
    this.componentMeta = {
      registry: { name: 'Registry Cross-Validation',       icon: 'database' },
      smbios:   { name: 'SMBIOS & Firmware Tables',        icon: 'chip' },
      bios:     { name: 'BIOS / UEFI Inspection',          icon: 'shield' },
      cpu:      { name: 'Processor Topology & CPUID',      icon: 'cpu' },
      memory:   { name: 'Memory Map & Slot Data',          icon: 'memory' },
      storage:  { name: 'NVMe / SMART Diagnostics',        icon: 'storage' },
      battery:  { name: 'Battery Controller & ACPI',       icon: 'battery' },
      display:  { name: 'EDID Parsing & Display Auth',     icon: 'display' },
      gpu:      { name: 'Graphics Controller Analysis',    icon: 'gpu' },
      network:  { name: 'Network Interfaces',              icon: 'network' },
      tpm:      { name: 'TPM Security Chip',               icon: 'shield' },
      consistency: { name: 'Consistency Engine Analysis',  icon: 'check' },
      scoring:  { name: 'Calculating Health Score',        icon: 'score' },
    };
  }

  startScan(demoMode = false) {
    this.completedCount = 0;

    const list = document.getElementById('scan-items-list');
    if (list) list.innerHTML = '';

    const pb = document.getElementById('scan-progress-bar');
    const pl = document.getElementById('scan-percent-label');
    const statusText = document.getElementById('scan-status-text');
    if (pb) pb.style.width = '0%';
    if (pl) pl.textContent = '0%';
    if (statusText) statusText.textContent = 'Connecting to hardware controllers...';

    this.startTime = Date.now();
    this._updateTimer();
    this.timer = setInterval(() => this._updateTimer(), 100);
  }

  // Called by the engine's progress events — creates item on-the-fly
  updateComponentStatus(id, status, data = null) {
    // Normalise id aliases
    const aliases = { smbios: 'smbios', ident: 'smbios', engine: 'consistency' };
    id = aliases[id] || id;

    const meta = this.componentMeta[id] || { name: id.charAt(0).toUpperCase() + id.slice(1), icon: 'chip' };
    const list = document.getElementById('scan-items-list');
    if (!list) return;

    // Find or create the list item
    let li = document.getElementById(`scan-item-${id}`);
    const isNew = !li;

    if (isNew) {
      li = document.createElement('li');
      li.className = 'scan-item scan-item-entering';
      li.id = `scan-item-${id}`;
      li.innerHTML = `
        <div class="scan-item-icon" id="scan-icon-${id}"><div class="scan-spinner"></div></div>
        <div class="scan-item-body">
          <div class="scan-item-name">${meta.name}</div>
          <div class="scan-item-state scanning-text" id="scan-state-${id}">Scanning...</div>
        </div>
        <div class="scan-item-time" id="scan-time-${id}">—</div>
      `;
      list.appendChild(li);
      // Trigger enter animation on next frame
      requestAnimationFrame(() => li.classList.remove('scan-item-entering'));
      // Update status text
      const statusText = document.getElementById('scan-status-text');
      if (statusText) statusText.textContent = `Inspecting ${meta.name}...`;
    }

    const icon = document.getElementById(`scan-icon-${id}`);
    const state = document.getElementById(`scan-state-${id}`);
    const timeEl = document.getElementById(`scan-time-${id}`);

    if (status === 'done' || status === 'error' || status === 'warning') {
      this.completedCount++;

      li.className = `scan-item scan-item-${status}`;

      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      if (timeEl) timeEl.textContent = `${elapsed}s`;

      if (status === 'done') {
        icon.innerHTML = `<svg class="si-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>`;
        if (state) { state.textContent = 'Verified'; state.className = 'scan-item-state state-done'; }
      } else if (status === 'error') {
        icon.innerHTML = `<svg class="si-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        if (state) { state.textContent = 'Failed'; state.className = 'scan-item-state state-error'; }
      } else if (status === 'warning') {
        icon.innerHTML = `<svg class="si-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
        if (state) { state.textContent = 'Flagged'; state.className = 'scan-item-state state-warning'; }
      }

      // Update progress bar
      const pct = Math.min(Math.floor((this.completedCount / this.totalExpected) * 100), 98);
      const pb = document.getElementById('scan-progress-bar');
      const pl = document.getElementById('scan-percent-label');
      if (pb) pb.style.width = `${pct}%`;
      if (pl) pl.textContent = `${pct}%`;
    }
  }

  onScanComplete() {
    clearInterval(this.timer);
    const pb = document.getElementById('scan-progress-bar');
    const pl = document.getElementById('scan-percent-label');
    const statusText = document.getElementById('scan-status-text');
    if (pb) pb.style.width = '100%';
    if (pl) pl.textContent = '100%';
    if (statusText) statusText.textContent = '✓ Scan Complete — Generating Report...';
    const sweep = document.getElementById('scan-sweep');
    if (sweep) sweep.style.display = 'none';
  }

  _updateTimer() {
    const el = document.getElementById('scan-elapsed');
    if (!el) return;
    const s = Math.floor((Date.now() - this.startTime) / 1000);
    const ms = Math.floor(((Date.now() - this.startTime) % 1000) / 100);
    el.textContent = `${s}.${ms}s`;
  }

}
