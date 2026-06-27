// =========================================================================
// ExportPreflightService — 导出预检逻辑，ExportWorker 和 Preflight API 共用
// =========================================================================

import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { scenes, videoClips } from "../../db/schema.js";

export interface ExportPreflightItem {
  sceneId: string;
  order: number;
  title: string;
  clipId: string;
  version: number;
  localPath: string;
  duration: number;
  approved: boolean;
  isCurrent: boolean;
}

export interface ExportPreflightResult {
  canExport: boolean;
  canPartialExport: boolean;
  totalScenes: number;
  readyScenes: number;
  approvedVideoScenes: number;
  estimatedDuration: number;
  missingScenes: Array<{
    sceneId: string;
    order: number;
    title: string;
    reason: string;
  }>;
  unapprovedVideoScenes: Array<{
    sceneId: string;
    order: number;
    title: string;
    clipId?: string;
    version?: number;
  }>;
  usingFallbackClips: Array<{
    sceneId: string;
    order: number;
    title: string;
    clipId: string;
    version: number;
    reason: string;
  }>;
  exportItems: ExportPreflightItem[];
}

export function buildExportPreflight(projectId: string): ExportPreflightResult {
  const sceneRows = db.select().from(scenes).where(eq(scenes.projectId, projectId)).orderBy(scenes.order).all();
  const allClips = db.select().from(videoClips).where(eq(videoClips.projectId, projectId)).all();

  const missingScenes: ExportPreflightResult["missingScenes"] = [];
  const unapprovedVideoScenes: ExportPreflightResult["unapprovedVideoScenes"] = [];
  const usingFallbackClips: ExportPreflightResult["usingFallbackClips"] = [];
  const exportItems: ExportPreflightItem[] = [];

  for (const scene of sceneRows) {
    const sceneClips = allClips.filter((c) => c.sceneId === scene.id);
    const readyClips = sceneClips.filter(
      (c) => c.status === "ready" && c.localPath && existsSync(c.localPath),
    );

        let selectedClip: (typeof videoClips.$inferSelect) | null = null;
    let isFallback = false;
    let fallbackReason = "";

    if (scene.currentClipId) {
      const currentClip = sceneClips.find((c) => c.id === scene.currentClipId);
      if (
        currentClip &&
        currentClip.status === "ready" &&
        currentClip.reviewStatus === "approved" &&
        currentClip.localPath &&
        existsSync(currentClip.localPath)
      ) {
        selectedClip = currentClip;
      } else if (currentClip) {
        isFallback = true;
        if (currentClip.status !== "ready") {
          fallbackReason = "当前版本状态为 " + currentClip.status + "，不可用";
        } else if (!currentClip.localPath || !existsSync(currentClip.localPath)) {
          fallbackReason = "当前版本文件丢失";
        } else if (currentClip.reviewStatus !== "approved") {
          fallbackReason = "当前版本未审核通过";
        }
      }
    }

    if (!selectedClip) {
      const approvedReadyClips = readyClips.filter((c) => c.reviewStatus === "approved");
      if (approvedReadyClips.length > 0) {
        selectedClip = approvedReadyClips.sort((a, b) => b.version - a.version)[0];
        if (!isFallback) {
          isFallback = true;
          fallbackReason = "未设置当前版本，使用最新可用版本";
        }
      }
    }

    if (!selectedClip) {
      if (readyClips.length > 0) {
        selectedClip = readyClips.sort((a, b) => b.version - a.version)[0];
        unapprovedVideoScenes.push({
          sceneId: scene.id,
          order: scene.order,
          title: scene.title,
          clipId: selectedClip.id,
          version: selectedClip.version,
        });
      } else {
        missingScenes.push({
          sceneId: scene.id,
          order: scene.order,
          title: scene.title,
          reason: sceneClips.length === 0 ? "无视频版本" : "视频未就绪",
        });
        continue;
      }
    }

    if (isFallback && selectedClip) {
      usingFallbackClips.push({
        sceneId: scene.id,
        order: scene.order,
        title: scene.title,
        clipId: selectedClip.id,
        version: selectedClip.version,
        reason: fallbackReason || "使用备用版本",
      });
    }

    exportItems.push({
      sceneId: scene.id,
      order: scene.order,
      title: scene.title,
      clipId: selectedClip.id,
      version: selectedClip.version,
      localPath: selectedClip.localPath!,
      duration: selectedClip.duration,
      approved: selectedClip.reviewStatus === "approved",
      isCurrent: scene.currentClipId === selectedClip.id,
    });
  }

  const totalScenes = sceneRows.length;
  const approvedCount = exportItems.filter((item) => item.approved).length;
  const canExport = totalScenes > 0 && exportItems.length === totalScenes && exportItems.every((item) => item.approved);
  const canPartialExport = exportItems.length > 0;
  const estimatedDuration = exportItems.reduce((sum, item) => sum + item.duration, 0);

  return {
    canExport,
    canPartialExport,
    totalScenes,
    readyScenes: exportItems.length,
    approvedVideoScenes: approvedCount,
    estimatedDuration,
    missingScenes,
    unapprovedVideoScenes,
    usingFallbackClips,
    exportItems,
  };
}