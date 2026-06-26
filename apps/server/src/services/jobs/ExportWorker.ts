// =========================================================================
// ExportWorker — 异步 FFmpeg 视频导出任务
// POST /export 返回后后台执行
// =========================================================================

import { writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { videoClips, scenes, projects } from "../../db/schema.js";
import { getJob, markRunning, markProgress, markSuccess, markFailed } from "./JobService.js";

const execFileAsync = promisify(execFile);
const DATA_ROOT = resolve(import.meta.dirname, "../../../../../local-data");

function getExportDir(projectId: string): string {
  const dir = resolve(DATA_ROOT, "projects", `project-${projectId}`, "exports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getConcatPath(projectId: string): string {
  return resolve(getExportDir(projectId), "concat.txt");
}

export async function runExportJob(
  jobId: string,
  projectId: string,
  allowPartial?: boolean,
): Promise<void> {
  try {
    markRunning(jobId);

    // ---- Step 1: 校验项目 ----
    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) { markFailed(jobId, "Project not found"); return; }
    markProgress(jobId, 10);

    // ---- Step 2: 读取 scenes + 收集 clip 路径 ----
    const sceneRows = db.select().from(scenes).where(eq(scenes.projectId, projectId)).orderBy(scenes.order).all();
    if (sceneRows.length === 0) { markFailed(jobId, "项目没有镜头"); return; }

    const clipPaths: string[] = [];
    const missingScenes: string[] = [];

    for (const scene of sceneRows) {
      // 优先使用当前版本（current_clip_id）
      if (scene.currentClipId) {
        const currentClip = db.select().from(videoClips).where(eq(videoClips.id, scene.currentClipId)).get();
        if (currentClip && currentClip.status === "ready") {
          if (!currentClip.localPath || !existsSync(currentClip.localPath)) {
            missingScenes.push(`${scene.title || `Scene ${scene.order}`}（当前版本文件丢失）`);
            continue;
          }
          clipPaths.push(currentClip.localPath);
          continue;
        }
      }

      // 兜底：取最新 ready 版本
      const clips = db.select().from(videoClips).where(eq(videoClips.sceneId, scene.id)).all()
        .filter((c) => c.status === "ready")
        .sort((a, b) => b.version - a.version);
      const bestClip = clips[0];
      if (!bestClip || !bestClip.localPath || !existsSync(bestClip.localPath)) {
        missingScenes.push(scene.title || `Scene ${scene.order}（无可用版本）`);
        continue;
      }
      clipPaths.push(bestClip.localPath);
    }

    if (clipPaths.length === 0) {
      markFailed(jobId, "没有可导出的视频片段（请先生成视频）");
      return;
    }

    if (missingScenes.length > 0 && !allowPartial) {
      markFailed(jobId, `缺少 ${missingScenes.length} 个镜头的视频片段: ${missingScenes.join("; ")}`);
      return;
    }

    markProgress(jobId, 30);

    // ---- Step 3: 取消检查 + 生成 concat.txt ----
    if (getJob(jobId)?.status === "cancelled") return;

    const concatLines = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`);
    const concatPath = getConcatPath(projectId);
    writeFileSync(concatPath, concatLines.join("\n"), "utf-8");
    markProgress(jobId, 50);

    // ---- Step 4: 取消检查 + FFmpeg 导出 ----
    if (getJob(jobId)?.status === "cancelled") return;

    const exportId = uuid().slice(0, 8);
    const filename = `final-${exportId}.mp4`;
    const outputPath = resolve(getExportDir(projectId), filename);
    const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

    markProgress(jobId, 80);
    let ffmpegOk = false;

    // 先尝试 concat（无需转码）
    try {
      await execFileAsync(ffmpegPath, ["-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", outputPath]);
      ffmpegOk = true;
    } catch {
      // 降级：转码
      try {
        await execFileAsync(ffmpegPath, [
          "-f", "concat", "-safe", "0", "-i", concatPath,
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", outputPath,
        ]);
        ffmpegOk = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "FFmpeg 失败";
        try { unlinkSync(concatPath); } catch {}
        markFailed(jobId, `导出失败: ${msg}`);
        return;
      }
    }

    try { unlinkSync(concatPath); } catch {}

    // ---- 完成 ----
    markProgress(jobId, 100);
    markSuccess(jobId, {
      outputPath,
      filename,
      sceneCount: clipPaths.length,
      missingScenes,
    });
  } catch (fatalErr) {
    const msg = fatalErr instanceof Error ? fatalErr.message : "Unknown error";
    markFailed(jobId, msg);
  }
}

export function startExportWorker(
  jobId: string,
  projectId: string,
  allowPartial?: boolean,
): void {
  setTimeout(() => {
    runExportJob(jobId, projectId, allowPartial).catch((err) => {
      console.error("[ExportWorker] fatal error:", err);
    });
  }, 0);
}
