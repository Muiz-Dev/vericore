const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const WebSocket = (() => {
  try {
    const wsPath = require.resolve('ws/package.json');
    return require(path.join(path.dirname(wsPath), 'index.js'));
  } catch (e) {
    return require('ws');
  }
})();
const { execSync, spawn } = require('child_process');

let mainWindow = null;
let wsClient = null;
let engineProcess = null;

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

  try {
    const exePath = process.execPath;
    // Use PowerShell to relaunch the packaged app with RunAs (triggers UAC shield)
    const p = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive',
      '-Command',
      `Start-Process -FilePath '${exePath}' -Verb RunAs`
    ], { detached: true, stdio: 'ignore' });

    p.on('error', (err) => {
      dialog.showErrorBox(
        'Elevation Required',
        `VeriCore requires administrative privileges to inspect hardware.\n\nFailed to relaunch as administrator: ${err.message}\n\nPlease right-click VeriCore and select "Run as administrator".`
      );
      app.quit();
    });

    p.unref();
    app.quit();
  } catch (err) {
    dialog.showErrorBox(
      'Elevation Required',
      `VeriCore requires administrative privileges to inspect hardware.\n\nFailed to relaunch: ${err.message}\n\nPlease right-click VeriCore and select "Run as administrator".`
    );
    app.quit();
  }
}

function resolveEnginePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'engine', 'vericore-engine.exe');
  }

  return path.join(__dirname, '..', 'engine', 'main.py');
}

function startEngine() {
  if (engineProcess) return;

  const enginePath = resolveEnginePath();
  const command = app.isPackaged ? enginePath : 'python';
  const args = app.isPackaged ? [] : [enginePath];

  try {
    engineProcess = spawn(command, args, {
      cwd: path.dirname(enginePath),
      windowsHide: true,
      stdio: 'ignore',
    });

    engineProcess.on('exit', () => {
      engineProcess = null;
    });

    engineProcess.on('error', (err) => {
      console.warn('Failed to start VeriCore engine process:', err.message);
      engineProcess = null;
    });
  } catch (err) {
    console.warn('Unable to start VeriCore engine:', err.message);
    engineProcess = null;
  }
}

function stopEngine() {
  if (!engineProcess) return;

  try {
    engineProcess.kill();
  } catch {
    // Engine may already be closed.
  }

  engineProcess = null;
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

  // FIX: Use file:// protocol for packaged apps
  if (app.isPackaged) {
    const indexPath = path.join(__dirname, 'src', 'index.html');
    mainWindow.loadFile(indexPath);
  } else {
    const indexPath = path.join(__dirname, 'src', 'index.html');
    mainWindow.loadFile(indexPath);
  }

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
            const pjson = require('./package.json');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'VeriCore',
              message: `VeriCore v${pjson.version}`,
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
  if (process.platform === 'win32' && app.isPackaged && !isAdmin()) {
    relaunchAsAdmin();
    return;
  }

  startEngine();
  createWindow();
});

app.on('window-all-closed', () => {
  stopEngine();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopEngine();
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
  const pjson = require('./package.json');
  return {
    cpu: os.cpus()[0]?.model || 'Unknown CPU',
    memory: os.totalmem(),
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    version: pjson.version
  };
});
