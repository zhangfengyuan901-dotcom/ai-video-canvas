// =========================================================================
// VideoService — 视频生成编排 + 后台轮询
// 多版本支持：每次生成创建新纪录，保留历史版本
// =========================================================================

import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { videoClips, scenes, storyboardPanels } from "../db/schema.js";
import { getVideoPath, writeVideoCurrentJson } from "./storage/AssetStorageService.js";
import {
  uploadMultipleBinaries,
  submitVideoTask,
  queryTaskStatus,
  downloadVideo,
  hasApiKey,
} from "./api/RunningHubVideoClient.js";
import { existsSync } from "node:fs";
import type { VideoClip } from "@ai-video-canvas/shared";

// ---- 类型 ---------------------------------------------------------------

export type ClipRow = typeof videoClips.$inferSelect;

// ---- 为单个场景提交视频生成 ------------------------------------------------

export async function generateForScene(
  scene: {
    id: string;
    projectId: string;
    order: number;
    title: string;
    motionPrompt: string;
    duration: number;
  },
  project: { aspectRatio: string; resolution: string },
): Promise<ClipRow> {
  if (!hasApiKey()) {
    throw new Error("RUNNINGHUB_API_KEY 未配置，请先设置 .env");
  }

  // 从 storyboard_panels.localPath 读取当前版本的 panel 图片路径
  const panelRows = db
    .select()
    .from(storyboardPanels)
    .where(eq(storyboardPanels.sceneId, scene.id))
    .all()
    .filter((p) => p.status === "ready");
  const panelPaths = [0, 1, 2]
    .map((i) => {
      const panel = panelRows.find((p) => p.panelIndex === i);
      return panel?.localPath;
    })
    .filter(Boolean) as string[];

  // 必须三张 panel（0/1/2）ready 且文件真实存在
  if (panelPaths.length !== 3) {
    const missing = [0, 1, 2]
      .filter((i) => !panelRows.find((p) => p.panelIndex === i))
      .map((i) => `panelIndex=${i}`);
    throw new Error(
      `场景 ${scene.order} (id=${scene.id}) 图生视频要求 panelIndex 0/1/2 三张 ready panel，` +
      `当前仅 ${panelPaths.length} 张可用。` +
      (missing.length > 0 ? ` 缺少: ${missing.join(", ")}。` : "") +
      ` 可用 panel: ${panelRows.map((r) => `[${r.panelIndex}] status=${r.status}`).join("; ")}`
    );
  }

  // 校验每张 panel 文件真实存在（panelIndex 0/1/2）
  for (let i = 0; i < 3; i++) {
    const panel = panelRows.find((p) => p.panelIndex === i);
    if (!panel || !panel.localPath || !existsSync(panel.localPath)) {
      throw new Error(
        `场景 ${scene.order} (id=${scene.id}) panelIndex=${i} 文件丢失: ${panel?.localPath ?? "(无路径)"}。` +
        `请重新生成故事板。`
      );
    }
  }

  // 上传 panel 图片到 RunningHub 临时存储（方案 A）
  // 获取 download_url 用于图生视频，比 Base64 更可靠
  const imageUrls = await uploadMultipleBinaries(panelPaths);

  // 确定版本号：查找该场景最大现有版本，+1
  const existingClips = db
    .select()
    .from(videoClips)
    .where(eq(videoClips.sceneId, scene.id))
    .all();
  const version =
    existingClips.length > 0
      ? Math.max(...existingClips.map((c) => c.version)) + 1
      : 1;

  // 收集 input panel IDs
  const inputPanelRows = db
    .select()
    .from(storyboardPanels)
    .where(eq(storyboardPanels.sceneId, scene.id))
    .all();
  const inputPanelIds = inputPanelRows.filter((p) => p.status === "ready").map((p) => p.id);

  // 构建 motion prompt
  const prompt =
    scene.motionPrompt || `${scene.title}, smooth camera movement, cinematic quality`;

  // 提交到 RunningHub
  const taskId = await submitVideoTask(
    prompt,
    imageUrls,
    project.aspectRatio,
    project.resolution,
    String(scene.duration),
  );

  const now = new Date().toISOString();
  const localPath = getVideoPath(scene.projectId, scene.id, version);

  // 始终创建新纪录（多版本）
  const clip: typeof videoClips.$inferInsert = {
    id: uuid(),
    projectId: scene.projectId,
    sceneId: scene.id,
    order: scene.order,
    version,
    prompt,
    taskId,
    localPath,
    inputPanelIdsJson: JSON.stringify(inputPanelIds),
    duration: scene.duration,
    resolution: project.resolution as any,
    aspectRatio: project.aspectRatio as any,
    status: "running",
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(videoClips).values(clip).run();

  return clip as ClipRow;
}

// ---- 轮询所有 running / queued 的 clip -----------------------------------

const POLL_INTERVAL_MS = 10_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startBackgroundPoller(): void {
  if (pollTimer) return;
  pollTimer = setInterval(pollPendingClips, POLL_INTERVAL_MS);
  console.log(`  [VideoService] 后台轮询已启动，间隔 ${POLL_INTERVAL_MS / 1000}s`);
}

export function stopBackgroundPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollPendingClips(): Promise<void> {
  try {
    const pending = db
      .select()
      .from(videoClips)
      .where(
        and(
          eq(videoClips.status, "running"),
        ),
      )
      .all()
      .filter((c) => c.taskId);

    if (pending.length === 0) return;

    for (const clip of pending) {
      await pollSingleClip(clip);
    }
  } catch (err) {
    console.error("[VideoService] 后台轮询出错:", err);
  }
}

async function pollSingleClip(clip: ClipRow): Promise<void> {
  if (!clip.taskId) return;

  try {
    const result = await queryTaskStatus(clip.taskId);

    if (result.status === "SUCCESS") {
      // 找到 mp4 URL 并下载
      const mp4Result = result.results?.find(
        (r) => r.outputType === "mp4" || r.url?.endsWith(".mp4"),
      );
      const videoUrl = mp4Result?.url ?? result.results?.[0]?.url;

      if (!videoUrl || !clip.localPath) {
        throw new Error("任务成功但未找到视频 URL");
      }

      await downloadVideo(videoUrl, clip.localPath);

      const now = new Date().toISOString();

      // 更新 clip 状态
      db.update(videoClips)
        .set({
          status: "ready",
          remoteUrl: videoUrl,
          updatedAt: now,
        })
        .where(eq(videoClips.id, clip.id))
        .run();

      // 写入 current.json 标记当前版本
      writeVideoCurrentJson(clip.projectId, clip.sceneId, clip.version, clip.localPath);

      // 如果 scene 尚未设置 current_clip_id，自动设为当前 clip
      const sceneRow = db.select().from(scenes).where(eq(scenes.id, clip.sceneId)).get();
      if (sceneRow && !sceneRow.currentClipId) {
        db.update(scenes)
          .set({ currentClipId: clip.id, updatedAt: new Date().toISOString() })
          .where(eq(scenes.id, clip.sceneId))
          .run();
      }

      // 更新 scene 状态
      db.update(scenes)
        .set({ status: "video_ready", updatedAt: now })
        .where(eq(scenes.id, clip.sceneId))
        .run();

      console.log(`  [VideoService] 视频就绪: scene=${clip.sceneId} v${clip.version}`);
    } else if (result.status === "FAILED") {
      const errMsg = result.errorMessage ?? JSON.stringify(result.failedReason ?? "未知错误");
      db.update(videoClips)
        .set({ status: "failed", error: errMsg, updatedAt: new Date().toISOString() })
        .where(eq(videoClips.id, clip.id))
        .run();
      console.error(`  [VideoService] 视频失败: scene=${clip.sceneId} err=${errMsg}`);
    }
    // QUEUED / RUNNING → 继续等待
  } catch (err) {
    const msg = err instanceof Error ? err.message : "轮询查询失败";
    console.error(`  [VideoService] 轮询 clip ${clip.id} 失败: ${msg}`);
  }
}
