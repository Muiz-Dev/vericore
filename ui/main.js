const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const { execSync, spawn } = require('child_process');

let mainWindow = null;
let wsClient = null;

// ── Admin Check & UAC Elevation ─────────────────────────────
function isAdmin() {
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function relaunchAsAdmin() {
  if (!app.isPackaged) {
    dialog.showMessageBoxSync({
      type: 'info',
      title: 'Development Mode',
      message: 'In development mode (npm start), please close the app and manually restart your terminal (PowerShell/Command Prompt) as Administrator, then run `npm start` again.',
    });
    return;
  }

  const exePath = process.execPath;
  // Use PowerShell to relaunch the packaged app with RunAs (triggers UAC shield)
  spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive',
    '-Command',
    `Start-Process -FilePath '${exePath}' -Verb RunAs`
  ], { detached: true, stdio: 'ignore' }).unref();
  
  app.quit();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#070b17',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (wsClient) {
      wsClient.close();
      wsClient = null;
    }
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Export Report',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow && mainWindow.webContents.send('menu-export'),
        },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', role: 'reload' },
        { label: 'Toggle DevTools', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Reset Zoom', role: 'resetZoom' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About VeriCore',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'VeriCore',
              message: 'VeriCore v1.0.0',
              detail: 'Device Authenticity & Hardware Inspection Platform\n\nDo not trust. Verify.',
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- IPC: Start scan by connecting to Python WebSocket engine ---
ipcMain.handle('start-scan', async () => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ action: 'scan' }));
    return { ok: true };
  }

  return new Promise((resolve) => {
    try {
      wsClient = new WebSocket('ws://127.0.0.1:7473');

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({ action: 'scan' }));
        resolve({ ok: true });
      });

      wsClient.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (!mainWindow) return;
          if (msg.event === 'progress') {
            mainWindow.webContents.send('scan-progress', msg);
          } else if (msg.event === 'complete') {
            mainWindow.webContents.send('scan-complete', msg);
          } else if (msg.event === 'diag_update') {
            mainWindow.webContents.send('diag-update', msg.metrics);
          } else if (msg.event === 'diag_complete') {
            mainWindow.webContents.send('diag-complete');
          } else if (msg.event === 'diag_single_complete') {
            mainWindow.webContents.send('diag-single-complete', msg.type);
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      });

      wsClient.on('error', (err) => {
        console.warn('Python engine not available, running in demo mode:', err.message);
        if (mainWindow) mainWindow.webContents.send('engine-unavailable');
        resolve({ ok: false, demo: true });
      });

      wsClient.on('close', () => {
        wsClient = null;
      });
    } catch (err) {
      resolve({ ok: false, demo: true });
    }
  });
});

// --- IPC: Run Diagnostics ---
ipcMain.handle('run-diagnostics', async (_event, duration) => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ action: 'run_diagnostics', duration: duration || 10 }));
    return { ok: true };
  }
  return { ok: false };
});

// --- IPC: Run Single Diagnostic ---
ipcMain.handle('run-diagnostics-single', async (_event, type, duration) => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ action: 'run_diagnostics_single', type, duration: duration || 10 }));
    return { ok: true };
  }
  return { ok: false };
});


// --- IPC: Save report ---
ipcMain.handle('save-report', async (_event, reportJson) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save VeriCore Report',
    defaultPath: `vericore-report-${Date.now()}.json`,
    filters: [{ name: 'JSON Report', extensions: ['json'] }],
  });
  if (!filePath) return { ok: false };
  const fs = require('fs');
  fs.writeFileSync(filePath, JSON.stringify(reportJson, null, 2), 'utf-8');
  return { ok: true, filePath };
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: Relaunch as Admin (from Settings panel)
ipcMain.handle('relaunch-admin', () => {
  relaunchAsAdmin();
});

// IPC: Get admin status
ipcMain.handle('get-admin-status', () => {
  return isAdmin();
});

// IPC: Get basic system info on load
ipcMain.handle('get-basic-system-info', () => {
  const os = require('os');
  return {
    cpu: os.cpus()[0]?.model || 'Unknown CPU',
    memory: os.totalmem(),
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()}`
  };
});
