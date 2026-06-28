// =========================================================================
// RhCliService — 包装 RH_CLI (Python) 命令行工具
// 通过 child_process.spawn 执行 rh --json <command>，解析 JSON 输出
// 如果 rh CLI 未安装，返回 { available: false }
// =========================================================================

import { execFile } from "node:child_process";
import { resolve } from "node:path";

// ---- 输出目录 -------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dirname, "../../../../../");
const OUTPUT_DIR = resolve(REPO_ROOT, "local-data", "rh-output");

// ---- 类型 -----------------------------------------------------------------

export interface RhCheckOutput {
  available: boolean;
  hint?: string;
  status?: string;
  keyPrefix?: string;
  keySource?: string;
  balance?: string;
  currency?: string;
  coins?: string;
  runningTasks?: string;
}

export interface RhModel {
  endpoint?: string;
  endpointName?: string;
  name?: string;
  type?: string;
  task?: string;
  description?: string;
}

export interface RhRunOutput {
  available: boolean;
  hint?: string;
  files?: string[];
  texts?: string[];
  cost?: string;
  duration?: number;
  taskId?: string;
  error?: string;
  message?: string;
}

// ---- 内部工具 -------------------------------------------------------------

const RH_TIMEOUT = 5 * 60 * 1000; // generation: 5 min
const RH_QUICK_TIMEOUT = 15 * 1000; // check / list: 15s

function spawnRh(
  args: string[],
  timeout: number = RH_TIMEOUT,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Verify rh is available — if not, resolve with empty to trigger graceful fallback
    const child = execFile("rh", args, {
      timeout,
      maxBuffer: 1024 * 1024, // 1MB stdout buffer
      env: { ...process.env, RH_OUTPUT_DIR: OUTPUT_DIR },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      // ENOENT = rh command not found
      if (err.code === "ENOENT") {
        resolve({ stdout: "", stderr: "RH CLI not installed" });
      } else {
        reject(err);
      }
    });

    child.on("close", (code) => {
      if (code === 0 || code === null) {
        resolve({ stdout, stderr });
      } else {
        // rh exits non-zero on errors — try to parse stderr as JSON
        resolve({ stdout, stderr });
      }
    });
  });
}

function parseRhJson<T>(stdout: string, stderr: string): T {
  // Try parsing stdout first
  if (stdout.trim()) {
    try {
      return JSON.parse(stdout.trim()) as T;
    } catch {
      // fall through to stderr
    }
  }

  // Try parsing stderr (rh outputs errors as JSON on stderr)
  if (stderr.trim()) {
    try {
      const err = JSON.parse(stderr.trim()) as { error?: string; message?: string };
      throw new Error(err.message ?? err.error ?? stderr.trim());
    } catch (e) {
      if (e instanceof Error && e.message !== stderr.trim()) throw e;
    }
  }

  throw new Error(stderr.trim() || "RH CLI returned empty output");
}

// ---- 公开 API -------------------------------------------------------------

export async function rhCheck(): Promise<RhCheckOutput> {
  try {
    const { stdout, stderr } = await spawnRh(["--json", "check"], RH_QUICK_TIMEOUT);
    if (stderr === "RH CLI not installed") {
      return { available: false, hint: "Install Python 3.10+ and run: pip install rh_cli" };
    }
    const data = parseRhJson<Record<string, unknown>>(stdout, stderr);
    return {
      available: true,
      status: data.status as string,
      keyPrefix: data.key_prefix as string,
      keySource: data.key_source as string,
      balance: data.balance as string,
      currency: data.currency as string,
      coins: data.coins as string,
      runningTasks: data.running_tasks as string,
    };
  } catch (err) {
    return {
      available: false,
      hint: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function rhListModels(
  type: "image" | "video",
): Promise<{ available: boolean; models?: RhModel[]; hint?: string }> {
  try {
    const { stdout, stderr } = await spawnRh(
      ["--json", "model", "list", "--type", type],
      RH_QUICK_TIMEOUT,
    );
    if (stderr === "RH CLI not installed") {
      return { available: false, hint: "Install Python 3.10+ and run: pip install rh_cli" };
    }
    const models = parseRhJson<RhModel[]>(stdout, stderr);
    return { available: true, models: Array.isArray(models) ? models : [] };
  } catch (err) {
    return {
      available: false,
      hint: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function rhRunImage(
  prompt: string,
  model?: string,
): Promise<RhRunOutput> {
  try {
    const args = ["--json", "image", "-p", prompt];
    if (model) args.push("--model", model);
    args.push("-o", OUTPUT_DIR);

    const { stdout, stderr } = await spawnRh(args);
    if (stderr === "RH CLI not installed") {
      return { available: false, hint: "Install Python 3.10+ and run: pip install rh_cli" };
    }
    const data = parseRhJson<Record<string, unknown>>(stdout, stderr);
    return {
      available: true,
      files: data.files as string[],
      texts: data.texts as string[],
      cost: data.cost as string,
      duration: data.duration as number,
      taskId: data.task_id as string,
    };
  } catch (err) {
    const data = tryParseRhError(err);
    return {
      available: true,
      error: data.error ?? (err instanceof Error ? err.message : "Unknown error"),
      message: data.message,
    };
  }
}

export async function rhRunVideo(
  prompt: string,
  model: string,
  duration?: number,
): Promise<RhRunOutput> {
  try {
    const args = ["--json", "video", "--model", model, "-p", prompt];
    if (duration) args.push("--duration", String(duration));
    args.push("-o", OUTPUT_DIR);

    const { stdout, stderr } = await spawnRh(args);
    if (stderr === "RH CLI not installed") {
      return { available: false, hint: "Install Python 3.10+ and run: pip install rh_cli" };
    }
    const data = parseRhJson<Record<string, unknown>>(stdout, stderr);
    return {
      available: true,
      files: data.files as string[],
      texts: data.texts as string[],
      cost: data.cost as string,
      duration: data.duration as number,
      taskId: data.task_id as string,
    };
  } catch (err) {
    const data = tryParseRhError(err);
    return {
      available: true,
      error: data.error ?? (err instanceof Error ? err.message : "Unknown error"),
      message: data.message,
    };
  }
}

function tryParseRhError(err: unknown): { error?: string; message?: string } {
  if (err instanceof Error) {
    try {
      return JSON.parse(err.message) as { error?: string; message?: string };
    } catch {
      return { error: err.message };
    }
  }
  return {};
}
