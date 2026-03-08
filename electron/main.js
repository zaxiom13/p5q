const path = require('path');
const os = require('os');
const fs = require('fs');
const { app, BrowserWindow, dialog, ipcMain, shell, screen } = require('electron');

let mainWindow = null;
let serverController = null;
let serverOrigin = 'http://127.0.0.1:5173';
let updateState = {
  status: 'idle',
  message: 'Updates have not been checked yet.',
  version: app.getVersion(),
  availableVersion: null
};
const gotSingleInstanceLock = app.requestSingleInstanceLock();
let autoUpdater = null;
let startServer = null;
let runtimeConfig = null;

if (!gotSingleInstanceLock) {
  app.quit();
}

function writeRawStartupLog(message) {
  try {
    const logDir = path.join(os.homedir(), 'Library', 'Logs', 'qanvas5-studio');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'desktop-startup.log'), `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {}
}

writeRawStartupLog('module-load:begin');

function logStartup(message) {
  try {
    writeRawStartupLog(message);
  } catch {}
}

function getAutoUpdater() {
  if (!autoUpdater) {
    ({ autoUpdater } = require('electron-updater'));
    logStartup('autoUpdater:loaded');
  }
  return autoUpdater;
}

function getServerModule() {
  if (!startServer) {
    ({ startServer } = require('../server'));
    logStartup('server-module:loaded');
  }
  return startServer;
}

function getRuntimeConfig() {
  if (!runtimeConfig) {
    runtimeConfig = require('./runtime-config');
    logStartup('runtime-config:loaded');
  }
  return runtimeConfig;
}

function appIconPath() {
  if (app.isPackaged && process.platform === 'darwin') {
    return path.join(process.resourcesPath, 'icon.icns');
  }
  return path.join(__dirname, '..', 'assets', 'icon.png');
}

function runtimeBinaryForServer(runtimeStatus) {
  if (!runtimeStatus || runtimeStatus.platform === 'windows') {
    return null;
  }
  return runtimeStatus.resolvedPath || runtimeStatus.qBinary || null;
}

async function startBackend(runtimeStatus = null) {
  serverController = getServerModule()({
    port: 0,
    qBinary: runtimeBinaryForServer(runtimeStatus)
  });
  const port = await serverController.listening;
  serverOrigin = `http://127.0.0.1:${port}`;
}

async function restartBackend(runtimeStatus = null) {
  if (serverController) {
    await serverController.close().catch(() => {});
  }
  await startBackend(runtimeStatus);
}

async function getRuntimeStatus() {
  const status = await getRuntimeConfig().resolveAndPersistRuntime(app.getPath('userData'));
  return status;
}

async function configureAndRestart() {
  const status = await getRuntimeConfig().resolveAndPersistRuntime(app.getPath('userData'));
  await restartBackend(status);
  return status;
}

async function loadSavedRuntimeStatus() {
  const saved = await getRuntimeConfig().loadRuntimeConfig(app.getPath('userData'));
  const savedBinary = typeof saved?.qBinary === 'string' ? saved.qBinary.trim() : '';
  return {
    platform: process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux',
    configured: Boolean(savedBinary),
    source: savedBinary ? 'saved' : null,
    qBinary: savedBinary || null,
    resolvedPath: savedBinary || null,
    message: savedBinary ? `Using saved q executable at ${savedBinary}` : 'No q executable selected yet.',
    guides: getRuntimeConfig().buildGuides(process.platform)
  };
}

async function createMainWindow() {
  logStartup('createMainWindow:begin');
  const display = screen.getPrimaryDisplay();
  const workArea = display?.workArea || { x: 80, y: 80, width: 1440, height: 900 };
  const width = Math.min(1520, Math.max(960, workArea.width - 80));
  const height = Math.min(960, Math.max(700, workArea.height - 80));
  const x = workArea.x + Math.max(20, Math.floor((workArea.width - width) / 2));
  const y = workArea.y + Math.max(20, Math.floor((workArea.height - height) / 2));
  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: 1220,
    minHeight: 760,
    backgroundColor: '#151512',
    title: 'Qanvas5 Studio',
    autoHideMenuBar: true,
    show: false,
    icon: process.platform === 'darwin' ? undefined : appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  logStartup('createMainWindow:constructed');
  mainWindow.once('ready-to-show', () => {
    logStartup('createMainWindow:ready-to-show');
    presentMainWindow();
  });
  setTimeout(() => {
    logStartup('createMainWindow:timeout-present');
    presentMainWindow();
  }, 300);

  await mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Qanvas5 Studio</title>
          <style>
            :root { color-scheme: dark; }
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #151512;
              color: #f4f0d8;
              font: 16px/1.5 -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .card {
              padding: 24px 28px;
              border: 1px solid rgba(244, 240, 216, 0.12);
              border-radius: 18px;
              background: rgba(27, 26, 20, 0.92);
              box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
            }
          </style>
        </head>
        <body>
          <div class="card">Starting Qanvas5 Studio...</div>
        </body>
      </html>
    `)}`
  );
  logStartup('createMainWindow:loaded-placeholder');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function presentMainWindow() {
  logStartup('presentMainWindow');
  if (!mainWindow || mainWindow.isDestroyed()) {
    logStartup('presentMainWindow:missing-window');
    return;
  }
  const display = screen.getDisplayMatching(mainWindow.getBounds()) || screen.getPrimaryDisplay();
  const workArea = display?.workArea || { x: 80, y: 80, width: 1440, height: 900 };
  const bounds = mainWindow.getBounds();
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width);
  const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height);
  mainWindow.setBounds({ x, y, width, height }, false);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.moveTop();
  mainWindow.focus();
  if (app.dock) {
    app.dock.show();
  }
  app.focus({ steal: true });
}

async function loadFrontend() {
  logStartup(`loadFrontend:${serverOrigin}`);
  if (!mainWindow || mainWindow.isDestroyed()) {
    logStartup('loadFrontend:missing-window');
    return;
  }
  await mainWindow.loadURL(serverOrigin);
  logStartup('loadFrontend:loaded');
}

async function showStartupError(error) {
  const detail = String(error?.stack || error?.message || error || 'Unknown startup error');
  logStartup(`showStartupError:${detail}`);
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createMainWindow();
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  await mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Qanvas5 Studio Startup Error</title>
          <style>
            :root { color-scheme: dark; }
            body {
              margin: 0;
              min-height: 100vh;
              padding: 32px;
              background: #151512;
              color: #f4f0d8;
              font: 15px/1.5 -apple-system, BlinkMacSystemFont, sans-serif;
            }
            h1 { margin-top: 0; font-size: 22px; }
            pre {
              white-space: pre-wrap;
              word-break: break-word;
              padding: 16px;
              border-radius: 12px;
              background: rgba(0, 0, 0, 0.28);
              border: 1px solid rgba(244, 240, 216, 0.12);
            }
          </style>
        </head>
        <body>
          <h1>Qanvas5 Studio could not finish starting</h1>
          <pre>${detail.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))}</pre>
        </body>
      </html>
    `)}`
  );
}

function broadcastUpdateState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('updates:state', updateState);
}

function setUpdateState(nextState) {
  updateState = {
    ...updateState,
    ...nextState,
    version: app.getVersion()
  };
  broadcastUpdateState();
}

function hasLocalUpdateConfig() {
  try {
    return fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  } catch {
    return false;
  }
}

function setupAutoUpdates() {
  if (!app.isPackaged || !hasLocalUpdateConfig()) {
    setUpdateState({
      status: 'idle',
      message: 'Auto-update checks activate in published release builds from GitHub Releases.',
      availableVersion: null
    });
    return;
  }

  const updater = getAutoUpdater();
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  updater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      message: 'Checking GitHub Releases for a newer version...',
      availableVersion: null
    });
  });

  updater.on('update-available', (info) => {
    setUpdateState({
      status: 'available',
      message: `Update ${info.version} is downloading now.`,
      availableVersion: info.version
    });
  });

  updater.on('update-not-available', (info) => {
    setUpdateState({
      status: 'up-to-date',
      message: `You are up to date on ${info.version || app.getVersion()}.`,
      availableVersion: null
    });
  });

  updater.on('error', (error) => {
    setUpdateState({
      status: 'error',
      message: error?.message || 'Update check failed.',
      availableVersion: null
    });
  });

  updater.on('download-progress', (progress) => {
    const percent = Number(progress?.percent || 0).toFixed(0);
    setUpdateState({
      status: 'downloading',
      message: `Downloading update: ${percent}%`,
      availableVersion: updateState.availableVersion
    });
  });

  updater.on('update-downloaded', (info) => {
    setUpdateState({
      status: 'downloaded',
      message: `Update ${info.version} is ready. Restart to install.`,
      availableVersion: info.version
    });
  });
}

async function checkForUpdates() {
  if (!app.isPackaged || !hasLocalUpdateConfig()) {
    setUpdateState({
      status: 'idle',
      message: 'Auto-update checks activate in published release builds from GitHub Releases.',
      availableVersion: null
    });
    return updateState;
  }

  try {
    await getAutoUpdater().checkForUpdates();
  } catch (error) {
    setUpdateState({
      status: 'error',
      message: error?.message || 'Update check failed.',
      availableVersion: null
    });
  }

  return updateState;
}

app.whenReady().then(async () => {
  logStartup('whenReady:begin');
  if (app.dock && process.platform !== 'darwin') {
    app.dock.setIcon(appIconPath());
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
      try {
        await loadFrontend();
      } catch {}
      presentMainWindow();
      return;
    }
    presentMainWindow();
  });

  app.on('second-instance', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      await createMainWindow();
      try {
        await loadFrontend();
      } catch {}
    }
    presentMainWindow();
  });

  await createMainWindow();

  try {
    const runtimeRoot = path.join(os.tmpdir(), 'qanvas5-studio-runtime');
    process.env.QANVAS5_TMP_DIR = path.join(runtimeRoot, 'tmp');
    process.env.QANVAS5_RUNTIME_CWD = runtimeRoot;
    process.env.QANVAS5_USER_DATA_PATH = app.getPath('userData');
    const savedRuntime = await loadSavedRuntimeStatus();
    logStartup(`whenReady:saved-runtime:${JSON.stringify(savedRuntime)}`);
    await startBackend(savedRuntime);
    logStartup('whenReady:backend-started');
    await loadFrontend();
    presentMainWindow();
    setupAutoUpdates();
    checkForUpdates();
    logStartup('whenReady:complete');
    getRuntimeConfig()
      .resolveAndPersistRuntime(app.getPath('userData'))
      .then((runtimeStatus) => {
        logStartup(`whenReady:background-runtime-resolved:${JSON.stringify(runtimeStatus)}`);
      })
      .catch((error) => {
        logStartup(`whenReady:background-runtime-error:${error?.stack || error}`);
      });
  } catch (error) {
    await showStartupError(error);
    presentMainWindow();
  }
});

app.on('window-all-closed', async () => {
  logStartup('window-all-closed');
  if (serverController) {
    await serverController.close().catch(() => {});
  }
  app.quit();
});

app.on('browser-window-created', () => {
  logStartup('browser-window-created');
});

app.on('render-process-gone', (_event, _webContents, details) => {
  logStartup(`render-process-gone:${JSON.stringify(details)}`);
});

process.on('uncaughtException', (error) => {
  logStartup(`uncaughtException:${error?.stack || error}`);
});

process.on('unhandledRejection', (error) => {
  logStartup(`unhandledRejection:${error?.stack || error}`);
});

ipcMain.handle('runtime:get-status', async () => getRuntimeStatus());

ipcMain.handle('runtime:auto-configure', async () => configureAndRestart());

ipcMain.handle('runtime:choose-binary', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Choose q executable',
    properties: ['openFile'],
    defaultPath: process.platform === 'darwin' ? '/opt/homebrew/bin' : undefined
  });

  if (result.canceled || result.filePaths.length === 0) {
    return getRuntimeStatus();
  }

  await getRuntimeConfig().setRuntimeBinary(app.getPath('userData'), result.filePaths[0]);
  return configureAndRestart();
});

ipcMain.handle('runtime:clear-binary', async () => {
  await getRuntimeConfig().setRuntimeBinary(app.getPath('userData'), '');
  return configureAndRestart();
});

ipcMain.handle('updates:get-state', async () => updateState);

ipcMain.handle('updates:check', async () => checkForUpdates());

ipcMain.handle('updates:install', async () => {
  if (updateState.status === 'downloaded') {
    getAutoUpdater().quitAndInstall();
    return true;
  }
  return false;
});

ipcMain.handle('shell:open-external', async (_event, url) => {
  if (typeof url === 'string' && url.startsWith('http')) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('app:get-server-origin', async () => serverOrigin);

ipcMain.handle('app:get-platform-info', async () => ({
  platform: process.platform,
  docs: getRuntimeConfig().DEFAULT_DOCS
}));
