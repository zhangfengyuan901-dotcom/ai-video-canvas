// =========================================================================
// StoryboardWorker — 异步故事板生成任务
// POST /storyboard/generate 返回后后台执行
// =========================================================================

import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { db } from "../../db/index.js";
import { projects, scenes, storyboardPanels } from "../../db/schema.js";
import { generatePanelPrompts } from "../llm/PanelPromptService.js";
import { generateAndDownload } from "../api/PackyImageClient.js";
import { getPanelPath } from "../storage/AssetStorageService.js";
import { composeStoryboardStrip } from "../storage/StripService.js";
import { getJob, markRunning, markProgress, markSuccess, markFailed, type JobRow } from "./JobService.js";
import type { StyleBible } from "@ai-video-canvas/shared";

// ---- 可读目录辅助 ---------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dirname, "../../../../../");
const PROJECTS_DIR = resolve(REPO_ROOT, "local-data", "projects");

function ensureReadableCopy(
  projectTitle: string,
  sceneOrder: number,
  panelIndex: number,
  sourcePath: string,
): string | null {
  try {
    const safeTitle = projectTitle.replace(/[<>:"/\\|?*]/g, "_").slice(0, 50);
    const dir = resolve(PROJECTS_DIR, safeTitle, `故事板${sceneOrder}`);
    mkdirSync(dir, { recursive: true });
    const ext = sourcePath.match(/\.(png|jpg|jpeg|webp)/i)?.[0] ?? ".png";
    const dest = resolve(dir, `panel_${panelIndex}${ext}`);
    copyFileSync(sourcePath, dest);
    console.log(`[StoryboardWorker] 已保存可读副本: ${dest}`);
    return dest;
  } catch (err) {
    console.warn("[StoryboardWorker] 保存可读副本失败:", err);
    return null;
  }
}

export async function runStoryboardJob(
  jobId: string,
  projectId: string,
  sceneIds: string[] | undefined,
): Promise<void> {
  try {
    markRunning(jobId);

    // 加载 project + style bible
    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) { markFailed(jobId, "Project not found"); return; }
    if (!project.styleBibleJson) { markFailed(jobId, "请先生成脚本（style bible 不存在）"); return; }

    const styleBible: Omit<StyleBible, "id" | "projectId"> = JSON.parse(project.styleBibleJson);
    const aspectRatio = project.aspectRatio as "16:9" | "9:16";

    // 确定要处理的 scenes
    const allScenes = db.select().from(scenes).where(eq(scenes.projectId, projectId)).orderBy(scenes.order).all();
    const sceneRows = sceneIds
      ? allScenes.filter((s) => sceneIds.includes(s.id)).sort((a, b) => a.order - b.order)
      : allScenes;

    if (sceneRows.length === 0) { markFailed(jobId, "没有找到需要处理的镜头"); return; }

    const scenesCount = sceneRows.length;
    const progressPerScene = 85 / scenesCount;
    let allCreatedPanels: Array<Record<string, unknown>> = [];
    let hasError = false;

    for (let si = 0; si < scenesCount; si++) {
      // 检查任务是否被用户取消
      if (getJob(jobId)?.status === "cancelled") {
        return; // 不标记 failed，前端会看到 cancelled 状态
      }
      const scene = sceneRows[si];
      const baseProgress = si * progressPerScene;

      try {
        // ---- Step 1: 生成 panel prompts ----
        markProgress(jobId, Math.round(baseProgress + progressPerScene * 0.10));

        const sceneData = {
          id: scene.id, projectId: scene.projectId, order: scene.order,
          title: scene.title, summary: scene.summary, scriptText: scene.scriptText,
          visualDescription: scene.visualDescription,
          characters: JSON.parse(scene.charactersJson),
          location: scene.location, shotSize: scene.shotSize,
          cameraAngle: scene.cameraAngle, cameraMovement: scene.cameraMovement,
          motionPrompt: scene.motionPrompt, dialogue: scene.dialogue ?? undefined,
          audioEffects: scene.audioEffects ?? undefined, duration: scene.duration,
          status: scene.status as any, locked: !!scene.locked,
          createdAt: scene.createdAt, updatedAt: scene.updatedAt,
        };

        
        const prompts = await generatePanelPrompts(sceneData, styleBible);

        // ---- Step 2: 逐个 panel 生成图片 ----
        const panelRecords: Array<Record<string, unknown>> = [];
        const existingPanelRecs = db
          .select().from(storyboardPanels)
          .where(eq(storyboardPanels.sceneId, scene.id)).all();

        for (const p of prompts) {
          if (getJob(jobId)?.status === "cancelled") return;
          const existing = existingPanelRecs.find((ep) => ep.panelIndex === p.panelIndex);
          if (existing && existing.locked) {
            panelRecords.push({ ...existing, locked: !!existing.locked });
            continue;
          }

          const version = existing ? existing.version + 1 : 1;
          const localPath = getPanelPath(projectId, scene.id, p.panelIndex, version);
          const panelId = existing ? existing.id : uuid();
          const now = new Date().toISOString();

          if (existing) {
            db.update(storyboardPanels).set({
              version, localPath, prompt: p.prompt, role: p.role,
              status: "generating", revisedPrompt: null, remoteUrl: null,
              error: null, updatedAt: now,
            }).where(eq(storyboardPanels.id, existing.id)).run();
          } else {
            db.insert(storyboardPanels).values({
              id: panelId, projectId, sceneId: scene.id,
              panelIndex: p.panelIndex, role: p.role, prompt: p.prompt,
              localPath, version, status: "generating",
              locked: 0, error: null, createdAt: now, updatedAt: now,
            }).run();
          }

          // 更新进度（当前 panel 完成时）
          const panelProgress = [0.35, 0.60, 0.85];
          markProgress(jobId, Math.round(baseProgress + progressPerScene * panelProgress[p.panelIndex]));

          try {
            const panelProgressMsg = (msg: string) => {
              db.update(storyboardPanels).set({
                error: `[生成中] ${msg}`, updatedAt: new Date().toISOString(),
              }).where(eq(storyboardPanels.id, panelId)).run();
            };

            const result = await generateAndDownload(p.prompt, localPath, aspectRatio, panelProgressMsg);
            db.update(storyboardPanels).set({
              status: "ready",
              revisedPrompt: result.revisedPrompt ?? null,
              remoteUrl: result.remoteUrl,
              error: null,
              updatedAt: new Date().toISOString(),
            }).where(eq(storyboardPanels.id, panelId)).run();

            // Save readable copy to 项目名/故事板N/
            if (existsSync(localPath)) {
              ensureReadableCopy(
                project.title,
                scene.order,
                p.panelIndex,
                localPath,
              );
            }
          } catch (imgErr) {
            const msg = imgErr instanceof Error ? imgErr.message : "Image generation failed";
            db.update(storyboardPanels).set({
              status: "failed", error: msg, updatedAt: new Date().toISOString(),
            }).where(eq(storyboardPanels.id, panelId)).run();
            hasError = true;
          }

          // 图片生成完成后检查取消
          if (getJob(jobId)?.status === "cancelled") return;

          const finalPanel = db.select().from(storyboardPanels).where(eq(storyboardPanels.id, panelId)).get();
          if (finalPanel) panelRecords.push({ ...finalPanel, locked: !!finalPanel.locked });
        }

        // ---- Step 3: 合成 strip + 更新 scene 状态 ----
        if (getJob(jobId)?.status === "cancelled") return;
        const allReady = panelRecords.every((p) => p.status === "ready");
        if (allReady) {
          const allCurrent = db.select().from(storyboardPanels)
            .where(eq(storyboardPanels.sceneId, scene.id)).all();
          const stripPaths = [0, 1, 2]
            .map((i) => { const p = allCurrent.find((p) => p.panelIndex === i); return p?.localPath; })
            .filter(Boolean) as string[];
          if (stripPaths.length === 3) {
            try { await composeStoryboardStrip(projectId, scene.id, stripPaths); } catch {}
          }
        }

        db.update(scenes).set({
          status: allReady ? "storyboard_ready" : "failed",
          updatedAt: new Date().toISOString(),
        }).where(eq(scenes.id, scene.id)).run();

        allCreatedPanels.push(...panelRecords);
      } catch (sceneErr) {
        const msg = sceneErr instanceof Error ? sceneErr.message : "Scene processing failed";
        db.update(scenes).set({ status: "failed", updatedAt: new Date().toISOString() })
          .where(eq(scenes.id, scene.id)).run();
        hasError = true;
      }
    }

    // ---- 结果 ----
    markProgress(jobId, 95);
    if (hasError) {
      markFailed(jobId, "部分 panel 生成失败，请查看各 panel 的 error 详情");
    } else {
      markSuccess(jobId, { processedCount: scenesCount, panels: allCreatedPanels });
    }
  } catch (fatalErr) {
    const msg = fatalErr instanceof Error ? fatalErr.message : "Unknown error";
    markFailed(jobId, msg);
  }
}

export function startStoryboardWorker(
  jobId: string,
  projectId: string,
  sceneIds?: string[],
): void {
  // 使用 setTimeout(0) 让请求先返回，后台再慢慢跑
  setTimeout(() => {
    runStoryboardJob(jobId, projectId, sceneIds).catch((err) => {
      console.error("[StoryboardWorker] fatal error:", err);
    });
  }, 0);
}
