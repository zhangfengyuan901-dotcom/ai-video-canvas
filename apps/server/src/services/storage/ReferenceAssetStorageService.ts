// =========================================================================
// ReferenceAssetStorageService — reference image file management
// Directory: local-data/projects/project-{id}/references/
// =========================================================================

import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { v4 as uuid } from "uuid";

const DATA_ROOT = resolve(import.meta.dirname, "../../../../../local-data");

function getReferenceDir(projectId: string): string {
  const dir = resolve(DATA_ROOT, "projects", `project-${projectId}`, "references");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export type ReferenceAssetMime = "image/png" | "image/jpeg" | "image/webp";

function extFromMime(mimeType: ReferenceAssetMime): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export function getReferenceImagePath(
  projectId: string,
  mimeType: ReferenceAssetMime,
): { localPath: string; filename: string } {
  const dir = getReferenceDir(projectId);
  const ext = extFromMime(mimeType);
  const filename = `ref-${uuid().slice(0, 12)}.${ext}`;
  return { localPath: resolve(dir, filename), filename };
}

export function ensureReferenceDir(projectId: string): string {
  return getReferenceDir(projectId);
}