// =========================================================================
// ExportService — FFmpeg concat 拼接导出完整视频
// =========================================================================

import { writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { videoClips, scenes, projects } from "../../db/schema.js";

const execFileAsync = promisify(execFile);

const DATA_ROOT = resolve(import.meta.dirname, "../../../../../local-data");

function getExportDir(projectId: string): string {
  const dir = resolve(DATA_ROOT, "projects", `project-${projectId}`, "exports");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getConcatPath(projectId: string): string {
  return resolve(getExportDir(projectId), "concat.txt");
}

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  sceneCount: number;
  missingScenes: string[];
}

export async function exportProjectVideo(projectId: string): Promise<ExportResult> {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) {
    return { success: false, error: "Project not found", sceneCount: 0, missingScenes: [] };
  }

  const sceneRows = db.select().from(scenes).where(eq(scenes.projectId, projectId)).orderBy(scenes.order).all();
  if (sceneRows.length === 0) {
    return { success: false, error: "项目没有镜头", sceneCount: 0, missingScenes: [] };
  }

  const clipPaths: string[] = [];
  const missingScenes: string[] = [];

  for (const scene of sceneRows) {
    // 优先使用当前版本（current_clip_id）
    if (scene.currentClipId) {
      const currentClip = db
        .select()
        .from(videoClips)
        .where(eq(videoClips.id, scene.currentClipId))
        .get();

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
    const clips = db
      .select()
      .from(videoClips)
      .where(eq(videoClips.sceneId, scene.id))
      .all()
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
    return {
      success: false,
      error: "没有可导出的视频片段（请先生成视频）",
      sceneCount: 0,
      missingScenes,
    };
  }

  // Generate concat.txt
  const concatLines = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`);
  const concatPath = getConcatPath(projectId);
  writeFileSync(concatPath, concatLines.join("\n"), "utf-8");

  const exportId = uuid().slice(0, 8);
  const outputPath = resolve(getExportDir(projectId), `final-${exportId}.mp4`);
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

  // Try concat without re-encoding first
  try {
    await execFileAsync(ffmpegPath, [
      "-f", "concat",
      "-safe", "0",
      "-i", concatPath,
      "-c", "copy",
      outputPath,
    ]);
    try { unlinkSync(concatPath); } catch {}
    return { success: true, outputPath, sceneCount: clipPaths.length, missingScenes };
  } catch {
    // Fallback: re-encode to ensure compatibility
    try {
      await execFileAsync(ffmpegPath, [
        "-f", "concat",
        "-safe", "0",
        "-i", concatPath,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        outputPath,
      ]);
      try { unlinkSync(concatPath); } catch {}
      return { success: true, outputPath, sceneCount: clipPaths.length, missingScenes };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "FFmpeg 失败";
      return { success: false, error: `导出失败: ${msg}`, sceneCount: clipPaths.length, missingScenes };
    }
  }
}
