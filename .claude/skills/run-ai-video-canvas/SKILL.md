---
name: run-ai-video-canvas
description: Build, run, and drive the AI Video Canvas app. Use when asked to start, run, build, test, or screenshot the app, or when asked to interact with its API or UI.
---

Web app (React + Vite frontend, Fastify backend, SQLite). Drive it by running
`smoke.mjs` which starts both servers, runs API smoke tests, takes a
Playwright screenshot, and stops cleanly. Also drivable via `curl` against
`localhost:3001` (backend) or `localhost:5173` (frontend with API proxy).

All paths below are relative to repo root.

## Prerequisites

**Windows:**
```powershell
# Node.js 20+ and npm are required. No extra system packages needed.
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3
# sharp and better-sqlite3 compile from source — build-essential covers both
```

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — at minimum PACKY_CHAT_API_KEY is needed for chat/script features.
# The app starts without API keys but chat/image/video generation will fail.
```

Database initialization (creates SQLite tables):

```bash
npm run db:push -w apps/server
```

## Build

No separate build step for development — both apps run via tsx/Vite in dev mode.
For production builds:

```bash
npm run build -w apps/server   # tsc → dist/
npm run build -w apps/web      # tsc + vite build → dist/
```

## Run (agent path)

### Full smoke test (start, verify, screenshot, stop)

```bash
node .claude/skills/run-ai-video-canvas/smoke.mjs
```

Output:
```
[smoke] Starting backend (Fastify)…
[smoke] Backend ready on :3001
[smoke] Starting frontend (Vite)…
[smoke] Frontend ready on :5173
[smoke] Running API smoke tests…
[smoke] Taking screenshot…
--- RESULTS ---
API tests: 4/4 passed
  ✓ GET /api/health (direct)
  ✓ GET /api/projects (direct)
  ✓ GET /api/health (via Vite proxy)
  ✓ GET /api/projects (via Vite proxy)
Screenshot: <os-tmp>/ai-video-canvas-shots/ai-video-canvas.png
Page title: AI 视频画布
```

Screenshots land in `<os-tmp>/ai-video-canvas-shots/`.

Options:
| flag | behavior |
|---|---|
| (none) | Full run: start servers, API tests, screenshot, stop |
| `--api-only` | Start servers, API tests only, stop. No Playwright needed. |
| `--screenshot-only` | Start servers, screenshot only, stop |

### API-only verification (no browser)

```bash
# Start servers in background
npx tsx apps/server/src/index.ts &
echo $! > /tmp/server.pid
(cd apps/web && npx vite --host 0.0.0.0 &)
echo $! > /tmp/vite.pid

# Wait for readiness
timeout 30 bash -c 'until curl -sf http://localhost:3001/api/health; do sleep 1; done'
timeout 30 bash -c 'until curl -sf http://localhost:5173/; do sleep 1; done'

# Smoke tests
curl -sf http://localhost:3001/api/health | head -c 200
curl -sf http://localhost:3001/api/projects | head -c 200
curl -sf http://localhost:5173/api/health | head -c 200
curl -sf http://localhost:5173/api/projects | head -c 200

# Stop
kill $(cat /tmp/server.pid) $(cat /tmp/vite.pid)
```

### Screenshot via Playwright (one-off, servers already running)

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/shots/ai-video-canvas.png' });
await browser.close();
```

Screenshots land in `<os-tmp>/ai-video-canvas-shots/` (via smoke.mjs) or `/tmp/shots/` (manual Playwright snippet).

## Run (human path)

```bash
npm run dev
# → Backend on http://localhost:3001, Frontend on http://localhost:5173
# Ctrl-C to stop both.
```

Or individually:

```bash
npm run dev:server   # → http://localhost:3001
npm run dev:web      # → http://localhost:5173
```

## Test

No project-level test suite exists yet. The smoke script above serves as the
integration verification.

Phase 0 verification scripts (require API keys):

```bash
npx tsx phase0/verify-1-gpt-script.ts
npx tsx phase0/verify-2-image-gen.ts
npx tsx phase0/verify-3-video-gen.ts
```

## Gotchas

- **`.env` is required at repo root.** The server loads `dotenv` from `cwd`,
  which must be the repo root. Running `tsx apps/server/src/index.ts` from
  inside `apps/server/` will miss env vars.
- **Database must exist before most API calls.** Run `npm run db:push -w apps/server`
  before first use, or the server starts but `/api/projects` and other DB-backed
  routes fail.
- **Vite proxy must be running for full frontend.** The React dev server proxies
  `/api/*` to `localhost:3001`. Direct backend calls work fine, but the frontend
  without the proxy will show "API Disconnected" in the UI.
- **sharp and better-sqlite3 are native modules.** On Linux they compile from
  source during `npm install` — `build-essential` and `python3` are needed.
  On Windows they install prebuilt binaries.
- **API keys are not needed to start the app.** The UI and project management
  work without them. Chat, image generation, and video generation will fail
  with clear error messages.

## Troubleshooting

- **`Error: Cannot find module 'better-sqlite3'`**: Native build failed. `sudo apt-get install -y build-essential python3 && npm rebuild`.
- **`EADDRINUSE` on port 3001 or 5173**: Leftover processes. `pkill -f "tsx.*index.ts" && pkill -f vite`.
- **Screenshot is blank / shows "API Disconnected"**: Vite proxy isn't running or backend is down. Verify both ports: `curl -sf http://localhost:3001/api/health && curl -sf http://localhost:5173/`.
- **Playwright not found**: `npm install --save-dev playwright && npx playwright install chromium`.
