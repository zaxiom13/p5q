import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { BrowserWindow } from "electrobun";

type ServerController = {
  listening: Promise<number>;
  close: () => Promise<void>;
};

const require = createRequire(import.meta.url);
const appRoot = resolveAppRoot();
const { resolveDesktopRuntimeStatus } = require(path.join(appRoot, "desktop", "runtime-status.js")) as {
  resolveDesktopRuntimeStatus: () => Promise<{
    platform: string;
    configured: boolean;
    source: string | null;
    qBinary: string | null;
    resolvedPath: string | null;
    message: string;
  }>;
};
const { startServer } = require(path.join(appRoot, "server.js")) as {
  startServer: (options?: {
    port?: number;
    qBinary?: string | null;
    runtimeStatus?: {
      platform: string;
      configured: boolean;
      source: string | null;
      qBinary: string | null;
      resolvedPath: string | null;
      message: string;
    } | null;
  }) => ServerController & { setRuntimeStatus?: (nextStatus: unknown) => void };
};

let mainWindow: BrowserWindow | null = null;
let serverController: ServerController | null = null;
let currentRuntimeStatus: {
  platform: string;
  configured: boolean;
  source: string | null;
  qBinary: string | null;
  resolvedPath: string | null;
  message: string;
} | null = null;

function resolveAppRoot() {
  const candidates = [
    process.env.QANVAS5_SOURCE_ROOT,
    process.env.INIT_CWD,
    process.env.PWD,
    path.resolve(import.meta.dir, "../.."),
    path.resolve(import.meta.dir, ".."),
    process.cwd()
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(path.join(candidate, "server.js"))) {
      writeStartupLog(`app-root:${candidate}`);
      return candidate;
    }
  }

  writeStartupLog(`app-root:fallback:${process.cwd()}`);
  return process.cwd();
}

function writeStartupLog(message: string) {
  try {
    const logDir = path.join(os.homedir(), "Library", "Logs", "qanvas5-studio");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, "electrobun-startup.log"),
      `[${new Date().toISOString()}] ${message}\n`,
      "utf8"
    );
  } catch {}
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function statusHtml(title: string, detail: string) {
  return `<!doctype html>
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
          width: min(760px, calc(100vw - 64px));
          padding: 24px 28px;
          border: 1px solid rgba(244, 240, 216, 0.12);
          border-radius: 18px;
          background: rgba(27, 26, 20, 0.92);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
        }
        h1 {
          margin: 0 0 12px;
          font-size: 22px;
        }
        p {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }
      </style>
    </head>
    <body>
      <section class="card">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(detail)}</p>
      </section>
    </body>
  </html>`;
}

function createMainWindow() {
  if (mainWindow) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    title: "Qanvas5 Studio",
    frame: {
      x: 80,
      y: 80,
      width: 1440,
      height: 900
    },
    html: statusHtml("Starting Qanvas5 Studio...", "Booting the local preview server inside Electrobun."),
    url: null,
    preload: null,
    renderer: "native",
    titleBarStyle: "default",
    transparent: false,
    navigationRules: null,
    sandbox: false
  });

  mainWindow.show();
  writeStartupLog("window:created");
  return mainWindow;
}

async function startBackend() {
  writeStartupLog("backend:start");
  currentRuntimeStatus = await resolveDesktopRuntimeStatus();
  const qBinary = currentRuntimeStatus?.resolvedPath || currentRuntimeStatus?.qBinary || null;
  writeStartupLog(`runtime-status:${JSON.stringify(currentRuntimeStatus)}`);
  serverController = startServer({
    port: 0,
    qBinary,
    runtimeStatus: currentRuntimeStatus
  });
  const port = await serverController.listening;
  const origin = `http://127.0.0.1:${port}`;
  writeStartupLog(`backend:listening:${origin}`);
  return origin;
}

async function showStartupError(error: unknown) {
  const detail = String((error as Error)?.stack || (error as Error)?.message || error || "Unknown startup error");
  writeStartupLog(`startup:error:${detail}`);
  const win = createMainWindow();
  win.webview.loadHTML(statusHtml("Electrobun startup failed", detail));
}

async function cleanup() {
  if (!serverController) {
    return;
  }

  try {
    await serverController.close();
    writeStartupLog("backend:closed");
  } catch (error) {
    writeStartupLog(`backend:close-error:${String(error)}`);
  } finally {
    serverController = null;
  }
}

async function boot() {
  const win = createMainWindow();
  const serverOrigin = await startBackend();
  win.webview.loadURL(serverOrigin);
  writeStartupLog(`window:load-url:${serverOrigin}`);
}

process.on("SIGINT", () => {
  cleanup().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  cleanup().finally(() => process.exit(0));
});

boot().catch(showStartupError);
