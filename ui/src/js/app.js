/* ═══════════════════════════════════════════════════
   VeriCore – app.js
   Main application controller
═══════════════════════════════════════════════════ */

'use strict';

// ── Mock Data ──────────────────────────────────────
const MOCK_REPORT = {
  timestamp: new Date().toISOString(),
  vericore_version: '1.0.0',
  scores: {
    health_score: 87,
    authenticity_score: 94,
    grade: 'B',
    component_scores: {
      cpu: 98, memory: 95, storage: 91,
      battery: 68, display: 90, gpu: 96,
      network: 100, tpm: 100
    }
  },
  system_summary: {
    manufacturer: 'Dell Inc.',
    model: 'Latitude 7420',
    serial: 'DLAT7420-9F2K1',
    bios_version: '1.24.0',
    uuid: 'A3F7B21C-44D9-4E08-8F1A-92CC3D01B7E5'
  },
  components: {
    cpu: {
      brand: 'Intel(R) Core(TM) i7-1185G7 @ 3.00GHz',
      vendor_id: 'GenuineIntel',
      architecture: 'X86_64',
      core_count_physical: 4,
      core_count_logical: 8,
      hz_advertised: '3.0 GHz',
      hz_actual: '2.98 GHz',
      l2_cache: '5 MB',
      l3_cache: '12 MB',
      wmi_name: 'Intel(R) Core(TM) i7-1185G7',
      wmi_manufacturer: 'Intel Corporation',
      consistency_issues: []
    },
    memory: {
      total_bytes: 17179869184,
      available_bytes: 9663676416,
      used_percent: 43.8,
      total_from_slots: 17179869184,
      slots: [
        { bank_label: 'DIMM A', capacity: 8589934592, speed: 4266, manufacturer: 'Samsung', part_number: 'M471A1K43DB1-CWE', memory_type: 'LPDDR4' },
        { bank_label: 'DIMM B', capacity: 8589934592, speed: 4266, manufacturer: 'Samsung', part_number: 'M471A1K43DB1-CWE', memory_type: 'LPDDR4' }
      ],
      consistency_issues: []
    },
    storage: [
      {
        model: 'Samsung SSD 970 EVO Plus 1TB',
        size_bytes: 1000204886016,
        interface_type: 'NVMe',
        serial_number: 'S4EWNX0N123456',
        firmware_revision: '2B2QEXM7',
        smart_status: 'OK',
        wmi_model: 'Samsung SSD 970 EVO Plus 1TB',
        consistency_issues: []
      }
    ],
    battery: {
      present: true,
      percent: 82,
      is_charging: false,
      design_capacity_mwh: 64000,
      current_capacity_mwh: 44480,
      wear_percent: 30.5,
      cycle_count: 287,
      manufacturer: 'SMP',
      chemistry: 'LiP',
      serial: 'BC123456',
      status: 'Discharging',
      consistency_issues: []
    },
    display: [
      {
        manufacturer_id: 'DEL',
        manufacturer_name: 'Dell',
        product_code: '0x41C6',
        manufacture_year: 2021,
        resolution_h: 1920,
        resolution_v: 1080,
        size_cm: '34x19 cm',
        monitor_name: 'Dell P2419H',
        wmi_name: 'Generic PnP Monitor',
        consistency_issues: [
          { description: 'WMI reports "Generic PnP Monitor" but EDID identifies Dell P2419H', severity: 'info' }
        ]
      }
    ],
    gpu: [
      {
        name: 'Intel(R) Iris(R) Xe Graphics',
        driver_version: '31.0.101.2130',
        driver_date: '2023-11-14',
        vram_bytes: 2147483648,
        resolution: '1920x1080',
        refresh_rate: 60,
        consistency_issues: []
      }
    ],
    network: {
      adapters: [
        { name: 'Intel(R) Wi-Fi 6 AX201', mac: 'A4:C3:F0:12:34:56', type: 'WiFi', manufacturer: 'Intel Corporation', speed: 1201 },
        { name: 'Intel(R) Ethernet Connection I219-LM', mac: '18:C0:4D:AB:CD:EF', type: 'Ethernet', manufacturer: 'Intel Corporation', speed: 1000 },
        { name: 'Intel(R) Wireless Bluetooth', mac: 'A4:C3:F0:78:9A:BC', type: 'Bluetooth', manufacturer: 'Intel Corporation', speed: null }
      ]
    },
    tpm: {
      present: true,
      activated: true,
      enabled: true,
      owned: true,
      manufacturer_id: '0x494e5443',
      manufacturer_name: 'Intel',
      version: '2.0',
      spec_version: '2.0',
      consistency_issues: []
    },
    bios: {
      manufacturer: 'Dell Inc.',
      version: '1.24.0',
      release_date: '2023-09-12',
      serial_number: 'DLAT7420-9F2K1',
      smbios_version: '3.2',
      system_manufacturer: 'Dell Inc.',
      system_model: 'Latitude 7420',
      secure_boot_enabled: true,
      uefi_mode: true,
      consistency_issues: []
    }
  },
  inconsistencies: [
    {
      field: 'Monitor Identification',
      source_a: 'WMI Win32_DesktopMonitor',
      value_a: 'Generic PnP Monitor',
      source_b: 'EDID Registry',
      value_b: 'Dell P2419H',
      severity: 'info',
      description: 'Windows reports a generic monitor name, but EDID data identifies the specific panel model.'
    }
  ],
  recommendations: [
    'Battery wear at 30.5% — consider monitoring degradation over time.',
    'Display driver reports a generic monitor name. Update display driver for accurate panel identification.',
    'SMART health confirmed OK. No storage anomalies detected.',
    'TPM 2.0 active and enabled. Secure Boot is on — security configuration is excellent.'
  ]
};

// ── App Controller ─────────────────────────────────
class VeriCoreApp {
  constructor() {
    this.currentView = 'dashboard';
    this.currentReport = null;
    this.scanController = null;
    this.reportRenderer = null;
    this.demoMode = true;
  }

  init() {
    this.scanController = new ScanController(this);
    this.reportRenderer = new ReportRenderer(this);
    this._bindNav();
    this._bindButtons();
    this._registerEngineEvents();
    this.showMockData();
    this._renderHistory();
    this._initSettings();
  }

  // ── Navigation ──────────────────────────────────
  navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const view = document.getElementById(`view-${viewId}`);
    if (view) view.classList.add('active');
    const nav = document.getElementById(`nav-${viewId}`);
    if (nav) nav.classList.add('active');
    this.currentView = viewId;
  }

  _bindNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.navigateTo(btn.dataset.view));
    });
  }

  _bindButtons() {
    const btnScan = document.getElementById('btn-begin-scan');
    if (btnScan) btnScan.addEventListener('click', () => this._startScan());

    const btnRescan = document.getElementById('btn-rescan');
    if (btnRescan) btnRescan.addEventListener('click', () => this._startScan());

    const btnExport = document.getElementById('btn-export-report');
    if (btnExport) btnExport.addEventListener('click', () => this._exportReport());

    // Diagnostics — individual + run all
    const diagBtns = [
      { id: 'btn-diag-cpu',     type: 'cpu' },
      { id: 'btn-diag-mem',     type: 'mem' },
      { id: 'btn-diag-stor',    type: 'stor' },
      { id: 'btn-diag-thermal', type: 'thermal' },
    ];
    diagBtns.forEach(({ id, type }) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => this._startSingleDiagnostic(type));
    });
    const runAllBtn = document.getElementById('btn-diag-all');
    if (runAllBtn) runAllBtn.addEventListener('click', () => this._startAllDiagnostics());

  }

  _registerEngineEvents() {
    if (!window.vericore) return;
    this.demoMode = false;

    window.vericore.onProgress((data) => {
      this.scanController.updateComponentStatus(data.component, data.status, data.data);
    });

    window.vericore.onComplete((data) => {
      if (data.report) {
        this.currentReport = data.report;
        this._saveToHistory(data.report);
        this.reportRenderer.render(data.report);
        this._populateDashboardFromReport(data.report);
        const ts = new Date(data.report.timestamp || Date.now());
        const el = document.getElementById('last-scan-time');
        if (el) el.textContent = `Scanned at ${ts.toLocaleTimeString()}`;
      }
      this.scanController.onScanComplete();
      setTimeout(() => this.navigateTo('report'), 800);
    });

    window.vericore.onEngineUnavailable(() => {
      this.demoMode = true;
    });

    window.vericore.onMenuExport(() => this._exportReport());
    
    // Diagnostics
    window.vericore.onDiagnosticsUpdate((metrics) => {
      this._updateDiagnosticUI(metrics);
    });
    window.vericore.onDiagnosticsComplete(() => {
      this._onDiagnosticsComplete();
    });
    window.vericore.onDiagnosticsSingleComplete((type) => {
      this._onSingleDiagnosticComplete(type);
    });

    // Admin status
    window.vericore.getAdminStatus().then(isAdmin => {
      this.isAdmin = isAdmin;
      const adminEl = document.getElementById('setting-admin-status');
      if (adminEl) adminEl.textContent = isAdmin ? '✓ Running as Administrator' : '✗ Standard User';
      if (adminEl) adminEl.style.color = isAdmin ? '#10b981' : '#f59e0b';
    });
  }

  // ── Scan ────────────────────────────────────────
  async _startScan() {
    this.navigateTo('scan');
    this.scanController.startScan(this.demoMode);

    if (!this.demoMode && window.vericore) {
      const result = await window.vericore.startScan();
      if (result.demo) {
        this.demoMode = true;
        // Start the demo sequence since the engine is unavailable
        this.scanController.startScan(true);
      }
    }
  }

  onScanDemoComplete() {
    this.currentReport = MOCK_REPORT;
    this._saveToHistory(MOCK_REPORT);
    this.reportRenderer.render(MOCK_REPORT);
    setTimeout(() => {
      this.navigateTo('report');
      document.getElementById('last-scan-time').textContent = 'Scanned just now';
    }, 600);
    this._populateDashboardFromReport(MOCK_REPORT);
  }

  // ── Export ──────────────────────────────────────
  async _exportReport() {
    if (!this.currentReport) {
      alert('No report available. Please run a scan first.');
      return;
    }
    if (window.vericore) {
      await window.vericore.saveReport(this.currentReport);
    } else {
      const blob = new Blob([JSON.stringify(this.currentReport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vericore-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ── Initial Dashboard Data ────────────────────────
  showMockData() {
    // Health ring stays at 0 until first scan
    this._setRingValue('health-ring-track', 0, false);
    this._setRingValue('auth-ring-track', 0, false);

    // Fetch basic OS info to populate dashboard immediately
    if (window.vericore && window.vericore.getBasicSystemInfo) {
      window.vericore.getBasicSystemInfo().then(info => {
        const memGB = (info.memory / 1e9).toFixed(1);
        
        // Update identity panel
        this._setText('id-manufacturer', 'Pending Scan');
        this._setText('id-model', 'Pending Scan');
        this._setText('id-serial', 'Pending Scan');
        this._setText('id-bios', 'Pending Scan');
        this._setText('id-uuid', 'Pending Scan');

        // Update component cards with basic info
        this._updateCard('cpu', info.cpu, 'Awaiting deep inspection', null);
        this._updateCard('memory', `${memGB} GB RAM`, 'Awaiting deep inspection', null);
        this._updateCard('storage', 'Local Storage', 'Awaiting deep inspection', null);
        this._updateCard('battery', 'Battery / Power', 'Awaiting deep inspection', null);
        this._updateCard('display', 'Displays', 'Awaiting deep inspection', null);
        this._updateCard('gpu', 'Graphics Adapters', 'Awaiting deep inspection', null);
        this._updateCard('network', 'Network Interfaces', 'Awaiting deep inspection', null);
        this._updateCard('tpm', 'Security Module', 'Awaiting deep inspection', null);
        
        // Set all statuses to pending
        ['cpu','mem','stor','bat','disp','gpu','net','tpm'].forEach(p => {
          const statusEl = document.getElementById(`${p}-card-status`);
          if (statusEl) {
            statusEl.innerHTML = `<span class="status-badge badge-neutral">Pending</span>`;
          }
        });
      });
    }
  }

  _populateDashboardFromReport(report) {
    const s = report.scores;
    const sum = report.system_summary;
    const comp = report.components;

    // Scores
    this._animateRing('health-ring-track', s.health_score, false);
    this._animateRing('auth-ring-track', s.authenticity_score, true);
    this._animateNumber('health-score-value', s.health_score, '%');
    this._animateNumber('auth-score-value', s.authenticity_score, '%');

    // Grade
    const grade = s.grade;
    const gradeColors = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444' };
    const hgb = document.getElementById('health-grade-badge');
    if (hgb) { hgb.textContent = `Grade ${grade}`; hgb.style.color = gradeColors[grade] || '#3b82f6'; }
    const agb = document.getElementById('auth-status-badge');
    if (agb) {
      const authLabel = s.authenticity_score >= 90 ? 'Verified' : s.authenticity_score >= 70 ? 'Minor Issues' : 'Review Required';
      agb.textContent = authLabel;
      agb.style.color = s.authenticity_score >= 90 ? '#10b981' : s.authenticity_score >= 70 ? '#f59e0b' : '#ef4444';
    }

    // Identity
    this._setText('id-manufacturer', sum.manufacturer);
    this._setText('id-model', sum.model);
    this._setText('id-serial', sum.serial);
    this._setText('id-bios', sum.bios_version);
    this._setText('id-uuid', sum.uuid);
    const notice = document.getElementById('no-scan-notice');
    if (notice) notice.style.display = 'none';

    // Component Cards
    const cs = s.component_scores;
    this._updateCard('cpu', comp.cpu.brand.replace(/\(R\)/g,'®').replace(/\(TM\)/g,'™'), `${comp.cpu.core_count_physical}C/${comp.cpu.core_count_logical}T · ${comp.cpu.hz_advertised}`, cs.cpu);
    const memGB = (comp.memory.total_bytes / 1e9).toFixed(0);
    const slots = comp.memory.slots;
    const memType = slots.length ? slots[0].memory_type : 'RAM';
    this._updateCard('memory', `${memGB} GB ${memType}`, `${slots.length} slots · ${slots[0]?.speed || '—'} MT/s`, cs.memory);
    const disk = comp.storage[0];
    const diskGB = disk ? (disk.size_bytes / 1e9).toFixed(0) : '—';
    this._updateCard('storage', disk ? disk.model : 'Unknown', `${diskGB} GB · ${disk?.interface_type || '—'} · ${disk?.smart_status || '—'}`, cs.storage);
    if (comp.battery?.present) {
      this._updateCard('battery', `${comp.battery.percent}% · ${comp.battery.status}`, `Wear: ${comp.battery.wear_percent.toFixed(1)}% · ${comp.battery.cycle_count} cycles`, cs.battery);
    } else {
      this._updateCard('battery', 'No Battery', 'Desktop system or battery not detected', 100);
    }
    const disp = comp.display[0];
    this._updateCard('display', disp ? disp.monitor_name : '—', disp ? `${disp.resolution_h}×${disp.resolution_v} · ${disp.manufacturer_name}` : '—', cs.display);
    const gpu = comp.gpu[0];
    this._updateCard('gpu', gpu ? gpu.name : '—', gpu ? `${gpu.driver_version} · ${gpu.resolution}` : '—', cs.gpu);
    const netCount = comp.network.adapters.length;
    const wifiAdapter = comp.network.adapters.find(a => a.type === 'WiFi');
    this._updateCard('network', wifiAdapter ? wifiAdapter.name : `${netCount} adapters`, `${netCount} adapters detected`, cs.network);
    const tpm = comp.tpm;
    this._updateCard('tpm', tpm.present ? `TPM ${tpm.version} · ${tpm.manufacturer_name}` : 'Not Present', tpm.present ? (tpm.activated ? 'Active & Enabled' : 'Present but inactive') : 'No TPM chip detected', cs.tpm);
  }

  _updateCard(key, value, meta, score) {
    this._setText(`${key.slice(0,3).toLowerCase()}-card-value`, value);
    // Map key to prefix
    const prefixMap = { cpu:'cpu', memory:'mem', storage:'stor', battery:'bat', display:'disp', gpu:'gpu', network:'net', tpm:'tpm' };
    const p = prefixMap[key] || key.slice(0,3);
    this._setText(`${p}-card-value`, value);
    this._setText(`${p}-card-meta`, meta);
    const statusEl = document.getElementById(`${p}-card-status`);
    if (statusEl) {
      const { label, cls } = this._scoreToStatus(score);
      statusEl.innerHTML = `<span class="status-badge ${cls}">${label}</span>`;
    }
  }

  _scoreToStatus(score) {
    if (score === undefined || score === null) return { label: '—', cls: 'badge-neutral' };
    if (score >= 90) return { label: 'Excellent', cls: 'badge-success' };
    if (score >= 75) return { label: 'Good',      cls: 'badge-success' };
    if (score >= 50) return { label: 'Fair',       cls: 'badge-warning' };
    return { label: 'Poor', cls: 'badge-danger' };
  }

  // ── Diagnostics Integration ─────────────────────────────
  async _startDiagnostics() {
    // Legacy: run all
    if (this.demoMode || !window.vericore) {
      alert('Active Diagnostics require the Python hardware engine.');
      return;
    }
    ['cpu', 'mem', 'stor', 'thermal'].forEach(t => this._setDiagStatus(t, 'Running...', '#3b82f6'));
    await window.vericore.runDiagnostics(10);
  }

  async _startSingleDiagnostic(type) {
    if (this.demoMode || !window.vericore) {
      this._runDiagDemo(type);
      return;
    }
    this._setDiagStatus(type === 'stor' ? 'storage' : type === 'mem' ? 'memory' : type, 'Running...', '#3b82f6');
    const typeMap = { cpu: 'cpu', mem: 'memory', stor: 'storage', thermal: 'thermal', memory: 'memory', storage: 'storage' };
    await window.vericore.runDiagnosticsSingle(typeMap[type] || type, 10);
  }

  async _startAllDiagnostics() {
    for (const t of ['cpu', 'memory', 'storage', 'thermal']) {
      this._setDiagStatus(t, 'Queued...', '#475569');
    }
    for (const t of ['cpu', 'memory', 'storage', 'thermal']) {
      await this._startSingleDiagnostic(t);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  _setDiagStatus(type, text, color) {
    const map = { cpu: 'cpu', memory: 'mem', storage: 'stor', thermal: 'thermal', mem: 'mem', stor: 'stor' };
    const id = map[type] || type;
    const el = document.getElementById(`diag-${id}-status`);
    if (el) { el.textContent = text; el.style.color = color; }
  }

  _runDiagDemo(type) {
    const typeId = type === 'memory' ? 'mem' : type === 'storage' ? 'stor' : type;
    this._setDiagStatus(typeId, 'Running...', '#3b82f6');
    const metricMap = {
      cpu:     [['dcpu-load','dcpu-temp','dcpu-freq'], ['78%','62°C','3.4 GHz']],
      mem:     [['dmem-tested','dmem-errors','dmem-speed'], ['8.0 GB','0','28 GB/s']],
      memory:  [['dmem-tested','dmem-errors','dmem-speed'], ['8.0 GB','0','28 GB/s']],
      stor:    [['dstor-read','dstor-write','dstor-iops'], ['3421 MB/s','2980 MB/s','412K']],
      storage: [['dstor-read','dstor-write','dstor-iops'], ['3421 MB/s','2980 MB/s','412K']],
      thermal: [['dtherm-cpu','dtherm-sys','dtherm-throttle'], ['58°C','42°C','No']]
    };
    const [ids, vals] = metricMap[type] || [[], []];
    setTimeout(() => {
      ids.forEach((id, i) => this._setText(id, vals[i]));
      this._setDiagStatus(typeId, 'Complete', '#10b981');
    }, 2000);
  }

  _updateDiagnosticUI(metrics) {
    if (metrics.cpu_active) {
      this._setText('dcpu-load', '100%');
      this._setText('dcpu-freq', 'MAX');
    }
    
    if (metrics.mem_active) {
      this._setText('dmem-tested', 'Allocating...');
      this._setText('dmem-errors', '0');
    }
    
    if (metrics.stor_active && metrics.storage) {
      this._setText('dstor-read', `${metrics.storage.mbps} MB/s`);
      this._setText('dstor-write', `${metrics.storage.mbps} MB/s`);
      this._setText('dstor-iops', `${metrics.storage.iops}`);
    }
    
    if (metrics.thermal) {
      this._setText('dcpu-temp', metrics.thermal.cpu_temp);
      this._setText('dtherm-cpu', metrics.thermal.cpu_temp);
      this._setText('dtherm-sys', metrics.thermal.sys_temp);
      this._setText('dtherm-throttle', metrics.thermal.throttling);
    }
  }

  _onDiagnosticsComplete() {
    ['cpu', 'mem', 'stor', 'thermal'].forEach(type => {
      this._setDiagStatus(type, 'Complete', '#10b981');
    });
    this._setText('dcpu-load', 'Idle');
    this._setText('dmem-tested', 'Complete');
    this._setText('dstor-read', 'Idle');
    this._setText('dstor-write', 'Idle');
  }

  _onSingleDiagnosticComplete(type) {
    const map = { cpu: 'cpu', memory: 'mem', storage: 'stor', thermal: 'thermal' };
    this._setDiagStatus(map[type] || type, 'Complete ✓', '#10b981');
  }

  // ── Scan History ─────────────────────────────────
  _saveToHistory(report) {
    try {
      const key = 'vc_scan_history';
      let history = JSON.parse(localStorage.getItem(key) || '[]');
      history.unshift({
        timestamp: report.timestamp,
        health: report.scores?.health_score,
        auth: report.scores?.authenticity_score,
        grade: report.scores?.grade,
        verdict: report.verdict?.label,
        model: report.system_summary?.model,
        manufacturer: report.system_summary?.manufacturer,
        report: report
      });
      history = history.slice(0, 5); // Keep last 5
      localStorage.setItem(key, JSON.stringify(history));
      this._renderHistory();
    } catch(e) { console.warn('Could not save history:', e); }
  }

  _renderHistory() {
    const container = document.getElementById('history-cards');
    if (!container) return;
    try {
      const history = JSON.parse(localStorage.getItem('vc_scan_history') || '[]');
      if (!history.length) {
        container.innerHTML = '<div class="history-empty">No scans recorded yet. Run your first scan to see history here.</div>';
        return;
      }
      container.innerHTML = history.map((h, i) => {
        const d = new Date(h.timestamp);
        const color = h.verdict === 'VERIFIED' ? '#10b981' : h.verdict === 'FLAGGED' ? '#f59e0b' : '#ef4444';
        return `
          <div class="history-card glass" onclick="app._loadHistoryEntry(${i})">
            <div class="hc-verdict" style="color:${color};border-color:${color}">${h.verdict || '—'}</div>
            <div class="hc-device">${h.manufacturer || '—'} ${h.model || '—'}</div>
            <div class="hc-scores">Health: <b>${h.health ?? '—'}%</b> &middot; Auth: <b>${h.auth ?? '—'}%</b></div>
            <div class="hc-time">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</div>
          </div>
        `;
      }).join('');
    } catch(e) { container.innerHTML = ''; }
  }

  _loadHistoryEntry(index) {
    try {
      const history = JSON.parse(localStorage.getItem('vc_scan_history') || '[]');
      const entry = history[index];
      if (entry?.report) {
        this.currentReport = entry.report;
        this.reportRenderer.render(entry.report);
        this.navigateTo('report');
      }
    } catch(e) {}
  }

  // ── Settings ─────────────────────────────────────
  _initSettings() {
    const depth = localStorage.getItem('vc_scan_depth') || 'deep';
    const depthEl = document.getElementById('setting-scan-depth');
    if (depthEl) depthEl.value = depth;

    const reg = localStorage.getItem('vc_registry') !== 'false';
    const regEl = document.getElementById('setting-registry');
    if (regEl) regEl.checked = reg;

    if (depthEl) depthEl.addEventListener('change', () => localStorage.setItem('vc_scan_depth', depthEl.value));
    if (regEl) regEl.addEventListener('change', () => localStorage.setItem('vc_registry', regEl.checked));

    const adminBtn = document.getElementById('btn-relaunch-admin');
    if (adminBtn && window.vericore) {
      adminBtn.addEventListener('click', () => window.vericore.relaunchAdmin());
    }

    const clearBtn = document.getElementById('btn-clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        localStorage.removeItem('vc_scan_history');
        this._renderHistory();
      });
    }
  }

  // ── Utilities ────────────────────────────────────
  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  _animateRing(trackId, score, isAuth) {
    const circumference = 2 * Math.PI * 50; // r=50
    const el = document.getElementById(trackId);
    if (!el) return;
    const offset = circumference - (score / 100) * circumference;
    requestAnimationFrame(() => { el.style.strokeDashoffset = offset; });
  }

  _setRingValue(trackId, score) {
    const circumference = 2 * Math.PI * 50;
    const el = document.getElementById(trackId);
    if (el) el.style.strokeDashoffset = circumference - (score / 100) * circumference;
  }

  _animateNumber(elId, target, suffix = '') {
    const el = document.getElementById(elId);
    if (!el) return;
    let current = 0;
    const step = target / 40;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.round(current) + suffix;
      if (current >= target) clearInterval(timer);
    }, 25);
  }
}

// ── Boot ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.app = new VeriCoreApp();
  window.app.init();
});
