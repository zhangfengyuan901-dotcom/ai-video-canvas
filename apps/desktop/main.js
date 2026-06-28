// =========================================================================
// Electron Main Process — AI Video Canvas Desktop
// =========================================================================

const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const isDev = process.env.NODE_ENV !== "production" && !app.isPackaged;
const BACKEND_PORT = 3001;
const FRONTEND_URL = `http://localhost:5173`;

let backendProcess = null;
let mainWindow = null;

// ---- Backend Lifecycle ---------------------------------------------------

function startBackend() {
  const repoRoot = isDev
    ? path.join(__dirname, "../..")
    : path.join(process.resourcesPath, "app");

  const serverDir = path.join(repoRoot, "apps", "server");
  const envPath = path.join(repoRoot, ".env");

  // Only start backend if .env exists (API keys configured)
  if (!fs.existsSync(envPath)) {
    console.log("[Desktop] No .env found — backend not started. Create .env with API keys first.");
    return;
  }

  console.log("[Desktop] Starting backend server...");
  backendProcess = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: serverDir,
    env: { ...process.env, SERVER_PORT: String(BACKEND_PORT), SERVER_HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  backendProcess.stdout?.on("data", (data) => {
    console.log("[Backend]", data.toString().trim());
  });
  backendProcess.stderr?.on("data", (data) => {
    console.error("[Backend]", data.toString().trim());
  });
  backendProcess.on("exit", (code) => {
    console.log(`[Desktop] Backend exited with code ${code}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log("[Desktop] Stopping backend...");
    backendProcess.kill();
    backendProcess = null;
  }
}

// ---- Window Creation -----------------------------------------------------

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "AI Video Canvas",
    backgroundColor: "#111827",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    // In dev: wait for backend, then load Vite frontend
    console.log("[Desktop] Waiting for backend...");
    await waitForBackend();
    console.log("[Desktop] Backend ready, loading frontend...");
    await mainWindow.loadURL(FRONTEND_URL);
  } else {
    // In production: load built frontend directly
    const distPath = path.join(__dirname, "../web/dist/index.html");
    console.log("[Desktop] Loading production build:", distPath);
    await mainWindow.loadFile(distPath);
  }

  return mainWindow;
}

// ---- Health Check Helper -------------------------------------------------

function waitForBackend(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve) => {
    function check() {
      if (Date.now() - start > timeoutMs) {
        console.log("[Desktop] Backend timeout — proceeding without it");
        resolve(false);
        return;
      }
      const http = require("http");
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) resolve(true);
        else setTimeout(check, 500);
      });
      req.on("error", () => setTimeout(check, 500));
      req.end();
    }
    check();
  });
}

// ---- App Lifecycle -------------------------------------------------------

app.whenReady().then(async () => {
  startBackend();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => stopBackend());
