// smoke.mjs — agent-facing driver for AI Video Canvas
// Starts both servers, verifies API health, takes a screenshot, stops cleanly.
//
// Usage:
//   node .claude/skills/run-ai-video-canvas/smoke.mjs
//   node .claude/skills/run-ai-video-canvas/smoke.mjs --api-only
//   node .claude/skills/run-ai-video-canvas/smoke.mjs --screenshot-only

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..", "..");
const SHOTS_DIR = resolve(tmpdir(), "ai-video-canvas-shots");

const args = new Set(process.argv.slice(2));
const API_ONLY = args.has("--api-only");
const SCREENSHOT_ONLY = args.has("--screenshot-only");
const RUN_SCREENSHOT = !API_ONLY;
const RUN_API = !SCREENSHOT_ONLY;

// ---- helpers -----------------------------------------------------------

function spawnBg(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
    ...opts,
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  return child;
}

async function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://localhost:${port}/api/health`);
      if (r.ok) return true;
    } catch {}
    // also try root for vite
    try {
      const r = await fetch(`http://localhost:${port}/`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ---- main --------------------------------------------------------------

const children = [];

async function main() {
  const results = { api: null, screenshot: null };

  // 1. Start backend
  console.log("[smoke] Starting backend (Fastify)…");
  const server = spawnBg("npx", ["tsx", "apps/server/src/index.ts"]);
  children.push(server);

  const backendReady = await waitForPort(3001);
  if (!backendReady) {
    console.error("[smoke] FAIL: Backend did not start within 30s");
    process.exit(1);
  }
  console.log("[smoke] Backend ready on :3001");

  // 2. Start frontend
  console.log("[smoke] Starting frontend (Vite)…");
  const web = spawnBg("npx", ["vite", "--host", "0.0.0.0"], {
    cwd: resolve(ROOT, "apps", "web"),
  });
  children.push(web);

  const frontendReady = await waitForPort(5173);
  if (!frontendReady) {
    console.error("[smoke] FAIL: Frontend did not start within 30s");
    process.exit(1);
  }
  console.log("[smoke] Frontend ready on :5173");

  // 3. API smoke tests
  if (RUN_API) {
    console.log("[smoke] Running API smoke tests…");
    results.api = await runApiTests();
  }

  // 4. Screenshot
  if (RUN_SCREENSHOT) {
    console.log("[smoke] Taking screenshot…");
    results.screenshot = await takeScreenshot();
  }

  // 5. Report
  console.log("\n--- RESULTS ---");
  let allPassed = true;
  if (results.api) {
    console.log(`API tests: ${results.api.passed}/${results.api.total} passed`);
    for (const t of results.api.tests) {
      console.log(`  ${t.ok ? "✓" : "✗"} ${t.name}`);
      if (!t.ok) allPassed = false;
    }
  }
  if (results.screenshot) {
    console.log(`Screenshot: ${results.screenshot.path}`);
    console.log(`Page title: ${results.screenshot.title}`);
    if (!results.screenshot.title) allPassed = false;
  }

  // 6. Clean stop
  for (const c of children) c.kill();
  process.exit(allPassed ? 0 : 1);
}

async function runApiTests() {
  const tests = [];
  const baseUrls = [
    "http://localhost:3001",
    "http://localhost:5173", // via Vite proxy
  ];

  for (const base of baseUrls) {
    const label = base.includes("5173") ? "via Vite proxy" : "direct";

    // Health check
    try {
      const r = await fetch(`${base}/api/health`);
      const j = await r.json();
      tests.push({
        name: `GET /api/health (${label})`,
        ok: r.status === 200 && j.status === "ok",
      });
    } catch (e) {
      tests.push({ name: `GET /api/health (${label})`, ok: false });
    }

    // Projects list
    try {
      const r = await fetch(`${base}/api/projects`);
      const j = await r.json();
      tests.push({
        name: `GET /api/projects (${label})`,
        ok: r.status === 200 && j.success === true && Array.isArray(j.data),
      });
    } catch (e) {
      tests.push({ name: `GET /api/projects (${label})`, ok: false });
    }
  }

  const passed = tests.filter((t) => t.ok).length;
  return { total: tests.length, passed, tests };
}

async function takeScreenshot() {
  mkdirSync(SHOTS_DIR, { recursive: true });

  // Dynamic import — playwright may not be installed in all environments
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto("http://localhost:5173", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);

  const shotPath = resolve(SHOTS_DIR, "ai-video-canvas.png");
  await page.screenshot({ path: shotPath, fullPage: false });

  const title = await page.title();
  await browser.close();

  return { path: shotPath, title };
}

// ---- cleanup -----------------------------------------------------------

process.on("exit", () => {
  for (const c of children) c.kill();
});
process.on("SIGINT", () => process.exit());
process.on("SIGTERM", () => process.exit());

main().catch((err) => {
  console.error("[smoke] Fatal:", err.message);
  process.exit(1);
});
