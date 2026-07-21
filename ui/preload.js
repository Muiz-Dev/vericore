const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vericore', {
  startScan: () => ipcRenderer.invoke('start-scan'),
  saveReport: (report) => ipcRenderer.invoke('save-report', report),

  onProgress: (callback) => {
    ipcRenderer.on('scan-progress', (_event, data) => callback(data));
  },
  onComplete: (callback) => {
    ipcRenderer.on('scan-complete', (_event, data) => callback(data));
  },
  onError: (callback) => {
    ipcRenderer.on('scan-error', (_event, data) => callback(data));
  },
  onEngineUnavailable: (callback) => {
    ipcRenderer.on('engine-unavailable', () => callback());
  },

  // Diagnostics
  runDiagnostics: (duration) => ipcRenderer.invoke('run-diagnostics', duration),
  runDiagnosticsSingle: (type, duration) => ipcRenderer.invoke('run-diagnostics-single', type, duration),
  onDiagnosticsUpdate: (callback) => {
    ipcRenderer.on('diag-update', (_event, data) => callback(data));
  },
  onDiagnosticsComplete: (callback) => {
    ipcRenderer.on('diag-complete', () => callback());
  },
  onDiagnosticsSingleComplete: (callback) => {
    ipcRenderer.on('diag-single-complete', (_event, type) => callback(type));
  },

  // Admin & Settings
  getAdminStatus: () => ipcRenderer.invoke('get-admin-status'),
  relaunchAdmin: () => ipcRenderer.invoke('relaunch-admin'),
  getBasicSystemInfo: () => ipcRenderer.invoke('get-basic-system-info'),

  // Export
  onMenuExport: (callback) => {
    ipcRenderer.on('menu-export', () => callback());
  },
});
