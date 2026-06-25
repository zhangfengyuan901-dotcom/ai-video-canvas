// =========================================================================
// StripService — 合成横向三宫格 storyboard-strip.png
// =========================================================================

import sharp from "sharp";
import { existsSync } from "node:fs";
import { getPanelPath, getStripPath, ensurePanelDir } from "./AssetStorageService.js";

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 240;

/**
 * 将 scene 的三个 panel 合成为横向三宫格图片
 * 返回 strip 本地路径
 */
export async function composeStoryboardStrip(
  projectId: string,
  sceneId: string,
): Promise<string> {
  const panelPaths = [0, 1, 2].map((i) => getPanelPath(projectId, sceneId, i));

  // 检查是否有 panel 文件
  const existing = panelPaths.filter((p) => existsSync(p));
  if (existing.length === 0) {
    throw new Error(`Scene ${sceneId} has no panel images`);
  }

  // 将所有 panel 缩放到统一尺寸
  const resized = await Promise.all(
    panelPaths.map((path) => {
      if (!existsSync(path)) {
        // 如果某个 panel 不存在，生成一个占位黑色图片
        return sharp({
          create: { width: PANEL_WIDTH, height: PANEL_HEIGHT, channels: 3, background: { r: 30, g: 30, b: 30 } },
        })
          .png()
          .toBuffer();
      }
      return sharp(path)
        .resize(PANEL_WIDTH, PANEL_HEIGHT, { fit: "cover", position: "center" })
        .toBuffer();
    }),
  );

  // 合成为横向三宫格
  const composite = resized.map((buffer, i) => ({
    input: buffer,
    top: 0,
    left: i * PANEL_WIDTH,
  }));

  const stripPath = getStripPath(projectId, sceneId);
  ensurePanelDir(projectId, sceneId);

  await sharp({
    create: {
      width: PANEL_WIDTH * 3,
      height: PANEL_HEIGHT,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(composite)
    .png()
    .toFile(stripPath);

  return stripPath;
}

/**
 * 检查 strip 是否存在
 */
export function stripExists(projectId: string, sceneId: string): boolean {
  return existsSync(getStripPath(projectId, sceneId));
}
