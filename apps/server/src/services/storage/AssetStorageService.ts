// =========================================================================
// AssetStorageService — 管理本地图片/视频资产存储
// 目录结构: local-data/projects/project-{id}/scenes/scene-{id}/panels/
//                                           /videos/
// =========================================================================

import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_ROOT = resolve(import.meta.dirname, "../../../../../local-data");

// ---- 目录管理 ---------------------------------------------------------------

function getProjectDir(projectId: string): string {
  return resolve(DATA_ROOT, "projects", `project-${projectId}`);
}

function ensureScenesDir(projectId: string): string {
  const dir = resolve(getProjectDir(projectId), "scenes");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensurePanelDir(projectId: string, sceneId: string): string {
  const dir = resolve(ensureScenesDir(projectId), sceneId, "panels");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureVideoDir(projectId: string, sceneId: string): string {
  const dir = resolve(ensureScenesDir(projectId), sceneId, "videos");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ---- 路径生成 ---------------------------------------------------------------

export function getPanelPath(projectId: string, sceneId: string, panelIndex: number, version?: number): string {
  const dir = ensurePanelDir(projectId, sceneId);
  const suffix = version && version > 1 ? `-v${version}` : '';
  return resolve(dir, `panel-${panelIndex}${suffix}.png`);
}

export type UploadImageExt = "png" | "jpg" | "jpeg" | "webp";

export function getUploadedPanelPath(
  projectId: string,
  sceneId: string,
  panelIndex: number,
  version: number,
  ext: UploadImageExt,
): string {
  const dir = ensurePanelDir(projectId, sceneId);
  return resolve(dir, `panel-${panelIndex}-upload-v${version}.${ext}`);
}

export function getStripPath(projectId: string, sceneId: string): string {
  const dir = ensurePanelDir(projectId, sceneId);
  return resolve(dir, "storyboard-strip.png");
}

export function getVideoPath(projectId: string, sceneId: string, version: number): string {
  const dir = ensureVideoDir(projectId, sceneId);
  return resolve(dir, `clip-v${version}.mp4`);
}

export function getVideoCurrentJsonPath(projectId: string, sceneId: string): string {
  const dir = ensureVideoDir(projectId, sceneId);
  return resolve(dir, "current.json");
}

export function writeVideoCurrentJson(
  projectId: string,
  sceneId: string,
  version: number,
  clipPath: string,
): void {
  const path = getVideoCurrentJsonPath(projectId, sceneId);
  const data = JSON.stringify(
    { currentVersion: version, currentClipPath: clipPath, updatedAt: new Date().toISOString() },
    null,
    2,
  );
  writeFileSync(path, data, "utf-8");
}

// ---- 文件检查 ---------------------------------------------------------------

export function panelExists(projectId: string, sceneId: string, panelIndex: number): boolean {
  return existsSync(getPanelPath(projectId, sceneId, panelIndex));
}

export function allPanelsExist(projectId: string, sceneId: string): boolean {
  for (let i = 0; i < 3; i++) {
    if (!panelExists(projectId, sceneId, i)) return false;
  }
  return true;
}
