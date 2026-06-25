// =========================================================================
// VideoWorker — 异步图生视频任务
// POST /videos/generate 返回后后台执行
// =========================================================================

import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { projects, scenes, videoClips } from "../../db/schema.js";
import { generateForScene, startBackgroundPoller } from "../VideoService.js";
import { hasApiKey } from "../api/RunningHubVideoClient.js";
import { getJob, markRunning, markProgress, markSuccess, markFailed } from "./JobService.js";

export async function runVideoJob(
  jobId: string,
  projectId: string,
  sceneIds?: string[],
): Promise<void> {
  try {
    markRunning(jobId);

    // ---- 校验项目 ----
    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) { markFailed(jobId, "Project not found"); return; }
    if (!hasApiKey()) { markFailed(jobId, "RUNNINGHUB_API_KEY 未配置"); return; }

    // ---- 校验场景 ----
    const allScenes = db.select().from(scenes).where(eq(scenes.projectId, projectId)).orderBy(scenes.order).all();
    const sceneRows = sceneIds
      ? allScenes.filter((s) => sceneIds.includes(s.id)).sort((a, b) => a.order - b.order)
      : allScenes;

    if (sceneRows.length === 0) { markFailed(jobId, "没有找到要处理的镜头"); return; }
    markProgress(jobId, 10); // 校验 scenes 完成

    const scenesCount = sceneRows.length;
    const perSceneProgress = 75 / scenesCount;
    const projectConfig = { aspectRatio: project.aspectRatio, resolution: project.resolution };
    const clipIds: string[] = [];
    let hasError = false;

    for (let si = 0; si < scenesCount; si++) {
      // ---- 取消检查 ----
      if (getJob(jobId)?.status === "cancelled") return;

      const scene = sceneRows[si];
      const sceneBase = 10 + si * perSceneProgress;
      markProgress(jobId, Math.round(sceneBase + perSceneProgress * 0.10)); // panel 校验中

      try {
        const clip = await generateForScene(
          {
            id: scene.id,
            projectId,
            order: scene.order,
            title: scene.title,
            motionPrompt: scene.motionPrompt,
            duration: scene.duration,
          },
          projectConfig,
        );

        // ---- 取消检查（upload + submit 完成后）----
        if (getJob(jobId)?.status === "cancelled") return;

        markProgress(jobId, Math.round(sceneBase + perSceneProgress * 0.85));
        clipIds.push(clip.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "生成失败";
        console.error(`[VideoWorker] scene ${scene.order} 失败: ${msg}`);
        hasError = true;
      }
    }

    markProgress(jobId, 95);

    // 启动后台轮询（如果尚未启动）
    startBackgroundPoller();

    if (hasError) {
      markFailed(jobId, "部分场景视频生成失败，请查看各 clip 的 error");
    } else {
      markSuccess(jobId, { processedCount: scenesCount, clipIds });
    }
  } catch (fatalErr) {
    const msg = fatalErr instanceof Error ? fatalErr.message : "Unknown error";
    markFailed(jobId, msg);
  }
}

export function startVideoWorker(
  jobId: string,
  projectId: string,
  sceneIds?: string[],
): void {
  setTimeout(() => {
    runVideoJob(jobId, projectId, sceneIds).catch((err) => {
      console.error("[VideoWorker] fatal error:", err);
    });
  }, 0);
}
