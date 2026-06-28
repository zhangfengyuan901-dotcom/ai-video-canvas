// =========================================================================
// Model Catalog — RunningHub 快捷模型端点映射
// 来源：RH_CLI 内置菜单 (Apache 2.0)
// =========================================================================

export interface CatalogModel {
  id: string;
  name: string;
  endpoint: string;
  desc: string;
  task?: string; // text-to-image, image-to-image, text-to-video, etc.
}

// ---- 图片模型 (5) ---------------------------------------------------------

export const IMAGE_MODELS: CatalogModel[] = [
  {
    id: "1",
    name: "全能图片PRO",
    endpoint: "rhart-image-n-pro/text-to-image",
    desc: "默认推荐，综合效果最好",
    task: "text-to-image",
  },
  {
    id: "2",
    name: "全能图片V2",
    endpoint: "rhart-image-v2/text-to-image",
    desc: "最快最便宜",
    task: "text-to-image",
  },
  {
    id: "3",
    name: "悠船 v7",
    endpoint: "youchuan-v7/text-to-image",
    desc: "Midjourney 风格，欧美大片质感",
    task: "text-to-image",
  },
  {
    id: "4",
    name: "GPT Image 2",
    endpoint: "gpt-image-2/text-to-image",
    desc: "语义理解强，改图也很稳",
    task: "text-to-image",
  },
  {
    id: "5",
    name: "Seedream v5",
    endpoint: "seedream-v5/text-to-image",
    desc: "字节出品，写实照片感超强",
    task: "text-to-image",
  },
];

// ---- 视频模型 (8) ---------------------------------------------------------

export const VIDEO_MODELS: CatalogModel[] = [
  {
    id: "1",
    name: "全能视频V3.1 Fast",
    endpoint: "rhvideo-v3-fast/text-to-video",
    desc: "又快又好，性价比之王（推荐）",
    task: "text-to-video",
  },
  {
    id: "2",
    name: "全能视频X",
    endpoint: "rhvideo-x/text-to-video",
    desc: "Grok 驱动，想象力超强",
    task: "text-to-video",
  },
  {
    id: "3",
    name: "可灵 v3.0 Pro",
    endpoint: "kling-v3-pro/text-to-video",
    desc: "运动自然，拍人物首选",
    task: "text-to-video",
  },
  {
    id: "4",
    name: "全能视频V3.1 Pro",
    endpoint: "rhvideo-v3-pro/text-to-video",
    desc: "电影感拉满，适合风景大片",
    task: "text-to-video",
  },
  {
    id: "5",
    name: "Vidu Q3 Pro",
    endpoint: "vidu-q3-pro/text-to-video",
    desc: "风格化独特，适合创意短片",
    task: "text-to-video",
  },
  {
    id: "6",
    name: "全能视频S",
    endpoint: "rhvideo-s/text-to-video",
    desc: "Sora 同款引擎",
    task: "text-to-video",
  },
  {
    id: "7",
    name: "海螺 Hailuo",
    endpoint: "hailuo/text-to-video",
    desc: "速度快、画面细腻",
    task: "text-to-video",
  },
  {
    id: "8",
    name: "Seedance 2.0",
    endpoint: "seedance-v2/text-to-video",
    desc: "最长 15 秒 + 自动配音，最高 4K",
    task: "text-to-video",
  },
];

// ---- 查找 ----------------------------------------------------------------

export function findImageModel(idOrName: string): CatalogModel | undefined {
  return IMAGE_MODELS.find(
    (m) => m.id === idOrName || m.name === idOrName,
  );
}

export function findVideoModel(idOrName: string): CatalogModel | undefined {
  return VIDEO_MODELS.find(
    (m) => m.id === idOrName || m.name === idOrName,
  );
}
