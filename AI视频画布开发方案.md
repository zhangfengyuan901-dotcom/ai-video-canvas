# AI 视频画布开发方案

> 文档版本：v1.0  
> 面向项目：本地运行的 AI 视频脚本 / 故事板 / 图生视频画布工具  
> 核心形态：左侧聊天框 + 中间画布 + 底部故事板/视频时间线  
> 主要能力：GPT 脚本生成、三宫格故事板、逐镜头图生视频、视频片段排序预览、局部重生成覆盖  
> 运行方式：本地运行，仅需配置 API Key

---

## 1. 项目目标

开发一个本地运行的 AI 视频创作工具。用户在左侧聊天框输入创意后，系统调用 GPT 生成结构化视频脚本，并自动拆成多个镜头。每个镜头生成 3 张关键帧图片，形成横向三宫格故事板。所有镜头按照顺序显示在底部故事板时间线上，用户可以拖拽排序、编辑镜头、重新生成某个镜头或某张图片。确认故事板顺序后，系统逐镜头调用图生视频 API，生成视频片段，并在底部视频轨道中按顺序排列，形成类似剪辑工具的预览体验。

最终用户可以：

1. 通过聊天生成视频脚本。
2. 通过画布编辑镜头、提示词、三宫格图片和视频片段。
3. 通过底部时间线预览故事板顺序和视频片段顺序。
4. 对不满意的图片或视频片段单独重生成并覆盖原片段。
5. 将所有片段拼接导出为完整视频。
6. 所有项目、脚本、图片、视频、任务记录保存在本地。

---

## 2. 开源项目参考源与参考定位

本方案不是直接照搬某一个 GitHub 项目，而是拆分参考多个开源项目的成熟部分，再重新组合为自己的产品形态。

### 2.1 参考项目总表

| 项目 | GitHub 源 | 参考定位 | 是否建议 Fork | 参考重点 |
|---|---|---|---|---|
| AIYOU_open-ai-video-drama-generator | https://github.com/yubowen123/AIYOU_open-ai-video-drama-generator | AI 漫剧 / 分镜 / 图片 / 视频节点平台 | 不建议直接 Fork，建议参考模块设计 | 节点类型、本地存储、分镜拆解、分镜视频生成节点 |
| ai_storyboard_video_generator | https://github.com/tillo13/ai_storyboard_video_generator | Python 脚本式故事生成与视频合成流水线 | 不建议 Fork | 脚本流水线、图像生成、FFmpeg 合成、字幕/配音思路 |
| timeline-editor-react | https://github.com/kevintech/timeline-editor-react | React 视频时间线组件 | 可参考或二次实现 | layer/frame 数据结构、拖拽时间线、onUpdateFrames 回调 |
| video-timeline-editor | https://github.com/faisalamin001/video-timeline-editor | 视频时间线编辑器示例 | 可参考 UI 思路 | 底部 timeline 交互风格 |
| react-video-editor-timeline | https://github.com/phanhavn/react-video-editor-timeline | React 视频时间线示例 | 可参考 UI 思路 | 视频轨道、帧块展示 |
| ComfyUI | https://github.com/Comfy-Org/ComfyUI | 节点式生成 AI 工作流工具 | 不建议 Fork | 任务节点、工作流图、异步执行状态、可扩展节点思想 |
| Packy Codex 文档 | https://docs.packyapi.com/docs/cli/3-codex.html | 开发期工程智能体配置 | 不是运行时依赖 | 使用 Codex 辅助开发、重构和生成模块 |
| Packy GPT-Image-2 文档 | https://docs.packyapi.com/docs/paint/GPTImage.html | 图片生成 API 约束 | 必须遵守 | Images API、Sora 分组令牌、n=1、尺寸限制 |
| RunningHub 图生视频文档 | 本项目 docs/vendor/runninghub-veo-image-to-video.md | 图生视频 API 约束 | 必须遵守 | imageUrls 最多 3 张、duration=8、轮询 taskId、结果链接 24 小时有效 |

### 2.2 AIYOU 参考定位

AIYOU 是最接近本项目的一类参考。它已经包含 AI 漫剧生成平台的节点式架构，并定义了大量节点类型，例如：

- PROMPT_INPUT
- IMAGE_GENERATOR
- VIDEO_GENERATOR
- SCRIPT_PLANNER
- STORYBOARD_GENERATOR
- STORYBOARD_IMAGE
- STORYBOARD_SPLITTER
- STORYBOARD_VIDEO_GENERATOR
- VIDEO_EDITOR

本项目应重点参考 AIYOU 的：

1. 节点类型拆分方式。
2. 分镜数据结构。
3. 本地文件存储组织方式。
4. 分镜视频生成节点的状态机。
5. 图片 / 视频 / 分镜 / 角色等不同资产类型的目录分类。

但是本项目不建议直接 Fork AIYOU，原因是：

1. AIYOU 更偏节点式漫剧生成平台。
2. 本项目目标是剪辑软件式产品壳：左侧聊天、中间画布、底部时间线。
3. 本项目需要围绕 Packy GPT、gpt-image-2、RunningHub 图生视频接口重新设计服务层。
4. 本项目的核心体验是逐镜头三宫格关键帧驱动视频片段生成，而不是通用节点工作流。

### 2.3 timeline-editor-react 参考定位

`timeline-editor-react` 是一个轻量 React 时间线组件，其 README 描述它可以构建类似视频编辑器的 Timeline，并支持拖拽 frames。它的数据结构由 layers 和 frames 组成：

```ts
const layers = [
  { id: 'layer-storyboard', name: 'Storyboard' },
  { id: 'layer-video', name: 'Video' }
];

const frames = {
  'layer-storyboard': [
    { name: 'Scene 01 Storyboard', second: 0, duration: 8 },
    { name: 'Scene 02 Storyboard', second: 8, duration: 8 }
  ],
  'layer-video': [
    { name: 'clip_001.mp4', second: 0, duration: 8 }
  ]
};
```

本项目应参考它的 layer/frame 抽象，但不要受限于它原来的 UI。建议自己实现一个更贴近 AI 视频创作的双轨时间线：

1. Storyboard Track：显示每个镜头的三宫格预览。
2. Video Track：显示每个镜头生成的视频片段。
3. Audio Track：后续可扩展配音、音乐、音效。
4. Marker Track：后续可扩展节奏点、字幕点、转场点。

---

## 3. 产品形态设计

### 3.1 页面整体布局

```text
┌─────────────────────────────────────────────────────────────┐
│ 顶部工具栏：项目名 / 保存状态 / API 状态 / 生成队列 / 导出 │
├───────────────┬─────────────────────────────────────────────┤
│ 左侧 ChatPanel │ 中间 Canvas / Inspector                    │
│               │                                             │
│ - 用户输入     │ - 当前选中镜头                              │
│ - GPT 回复     │ - 三宫格故事板预览                          │
│ - 脚本生成     │ - 镜头文本 / 运镜 / 台词 / 音效              │
│ - 修改指令     │ - 图片重生成 / 视频重生成                    │
│               │                                             │
├───────────────┴─────────────────────────────────────────────┤
│ 底部 Timeline                                               │
│ Storyboard Track: [三宫格01][三宫格02][三宫格03]             │
│ Video Track:      [clip01 ][clip02 ][clip03 ]               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 左侧聊天框

职责：

1. 接收用户自然语言创意。
2. 调用 GPT 生成结构化视频脚本。
3. 支持用户继续追问和修改脚本。
4. 支持用户指定风格、角色、时长、比例、用途。
5. 将 GPT 输出转化为 `Project`、`Scene`、`StoryboardPanel` 数据。

聊天不直接调用图片或视频 API，而是生成“任务指令”，交给本地 AgentRouter 执行。

### 3.3 中间画布

职责：

1. 展示当前项目的镜头卡片。
2. 展示当前选中镜头的三宫格。
3. 展示镜头详细字段：画面描述、景别、机位、运镜、主体、场景、对白、音效。
4. 支持编辑镜头文本。
5. 支持单张 panel 重生成。
6. 支持整个镜头三宫格重生成。
7. 支持视频片段重生成。
8. 支持锁定某张图，避免重生成时覆盖。

### 3.4 底部时间线

职责：

1. 按镜头顺序展示故事板三宫格。
2. 按镜头顺序展示视频片段。
3. 支持拖拽排序。
4. 支持点击选中镜头。
5. 支持右键菜单：重生成图片、重生成视频、锁定、删除、复制、插入镜头。
6. 支持视频片段播放预览。
7. 支持按当前顺序导出完整视频。

---

## 4. 推荐技术栈

### 4.1 推荐方案 A：Electron + React + Node.js

适合快速开发，前后端都用 TypeScript，访问本地文件系统和 FFmpeg 较方便。

```text
前端：React + Vite + TypeScript
画布：Konva 或 Fabric.js
时间线：自研 Timeline，参考 timeline-editor-react 数据结构
桌面壳：Electron
本地后端：Node.js + Fastify
数据库：SQLite + Drizzle ORM
文件存储：本地项目目录
任务队列：SQLite jobs 表 + Worker
视频处理：ffmpeg / fluent-ffmpeg
API 调用：fetch / undici / axios
状态管理：Zustand
拖拽排序：dnd-kit
```

优点：

1. 开发速度快。
2. Node.js 能直接处理文件、下载、FFmpeg、API 请求。
3. 前后端共享 TypeScript 类型。
4. 适合和 Codex 配合生成代码。

缺点：

1. 安装包体积大。
2. Electron 占用资源比 Tauri 高。

### 4.2 推荐方案 B：Tauri + React + Rust Sidecar

适合更长期产品化，但开发复杂度更高。

```text
前端：React + Vite + TypeScript
桌面壳：Tauri
本地服务：Rust commands 或 Node sidecar
数据库：SQLite
视频处理：ffmpeg sidecar
```

如果你现在目标是尽快做 MVP，建议选择 Electron。

---

## 5. 项目目录结构

```text
ai-video-canvas/
├── apps/
│   ├── desktop/                      # Electron 主进程
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── preload.ts
│   │   │   └── ipc.ts
│   │   └── package.json
│   │
│   ├── web/                          # React 前端
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── chat/
│   │   │   │   ├── canvas/
│   │   │   │   ├── timeline/
│   │   │   │   ├── storyboard/
│   │   │   │   └── video/
│   │   │   ├── stores/
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   └── main.tsx
│   │   └── package.json
│   │
│   └── server/                       # 本地 API 服务
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   ├── services/
│       │   │   ├── agent/
│       │   │   ├── llm/
│       │   │   ├── image/
│       │   │   ├── video/
│       │   │   ├── storage/
│       │   │   ├── timeline/
│       │   │   └── export/
│       │   ├── workers/
│       │   ├── db/
│       │   └── types/
│       └── package.json
│
├── packages/
│   ├── shared/                       # 前后端共享类型
│   │   ├── src/types.ts
│   │   └── src/schemas.ts
│   └── prompts/                      # Prompt 模板
│       ├── script-generate.md
│       ├── storyboard-generate.md
│       ├── image-panel-generate.md
│       └── video-prompt-generate.md
│
├── docs/
│   ├── 开发方案文档.md
│   ├── api.md
│   ├── data-model.md
│   ├── prompt-design.md
│   └── vendor/
│       └── runninghub-veo-image-to-video.md
│
├── local-data/                       # 本地运行时数据，gitignore
│   └── projects/
│
├── .env.example
├── AGENTS.md
├── package.json
└── README.md
```

---

## 6. 本地存储设计

参考 AIYOU 的本地存储方案，本项目也要把生成资产保存到用户指定的本地文件夹。AIYOU 的方案按 workspace 和节点类型分类，本项目应改为按 project、scene、asset 类型分类。

### 6.1 本地文件结构

```text
local-data/
└── projects/
    └── project-[projectId]/
        ├── project.json
        ├── database.sqlite
        ├── script/
        │   ├── original-user-prompt.md
        │   ├── script-structured.json
        │   └── style-bible.json
        ├── scenes/
        │   ├── scene-001/
        │   │   ├── scene.json
        │   │   ├── panels/
        │   │   │   ├── panel-0.png
        │   │   │   ├── panel-1.png
        │   │   │   ├── panel-2.png
        │   │   │   └── storyboard-strip.png
        │   │   ├── video/
        │   │   │   ├── clip-v1.mp4
        │   │   │   ├── clip-v2.mp4
        │   │   │   └── current.json
        │   │   └── logs/
        │   │       ├── image-generation.jsonl
        │   │       └── video-generation.jsonl
        │   └── scene-002/
        ├── timeline/
        │   ├── storyboard-track.json
        │   ├── video-track.json
        │   └── export-list.txt
        ├── exports/
        │   └── final-v1.mp4
        └── jobs/
            └── jobs.jsonl
```

### 6.2 为什么必须本地保存远程结果

1. 图片 URL 可能过期或失效。
2. RunningHub 图生视频结果 URL 有 24 小时有效期限制。
3. 用户需要离线打开项目。
4. 局部重生成时需要保留历史版本。
5. 后续导出完整视频时需要本地 mp4 文件。

### 6.3 文件命名规范

```text
scene-001/panels/panel-0.png             # 起始帧
scene-001/panels/panel-1.png             # 中间帧
scene-001/panels/panel-2.png             # 结束帧
scene-001/panels/storyboard-strip.png    # 横向三宫格预览
scene-001/video/clip-v1.mp4              # 第一次生成的视频
scene-001/video/clip-v2.mp4              # 第二次重生成的视频
scene-001/video/current.json             # 当前使用哪一个版本
```

---

## 7. 数据模型设计

### 7.1 Project

```ts
export interface Project {
  id: string;
  title: string;
  description?: string;
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p' | '4k';
  defaultSceneDuration: 8;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
}
```

### 7.2 StyleBible

```ts
export interface StyleBible {
  id: string;
  projectId: string;
  visualStyle: string;
  colorPalette: string;
  lightingStyle: string;
  cameraLanguage: string;
  characterConsistency: string;
  negativePrompt?: string;
}
```

### 7.3 Scene

```ts
export interface Scene {
  id: string;
  projectId: string;
  order: number;
  title: string;
  summary: string;
  scriptText: string;
  visualDescription: string;
  characters: string[];
  location: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  motionPrompt: string;
  dialogue?: string;
  audioEffects?: string;
  duration: 8;
  status: 'draft' | 'storyboard_generating' | 'storyboard_ready' | 'video_generating' | 'video_ready' | 'failed';
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 7.4 StoryboardPanel

```ts
export interface StoryboardPanel {
  id: string;
  projectId: string;
  sceneId: string;
  panelIndex: 0 | 1 | 2;
  role: 'start' | 'middle' | 'end';
  prompt: string;
  revisedPrompt?: string;
  remoteUrl?: string;
  localPath?: string;
  width?: number;
  height?: number;
  status: 'queued' | 'generating' | 'ready' | 'failed';
  locked: boolean;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 7.5 VideoClip

```ts
export interface VideoClip {
  id: string;
  projectId: string;
  sceneId: string;
  order: number;
  version: number;
  prompt: string;
  taskId?: string;
  remoteUrl?: string;
  localPath?: string;
  duration: 8;
  resolution: '720p' | '1080p' | '4k';
  aspectRatio: '16:9' | '9:16';
  inputPanelIds: string[];
  status: 'queued' | 'running' | 'ready' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 7.6 TimelineTrack / TimelineItem

```ts
export interface TimelineTrack {
  id: string;
  projectId: string;
  type: 'storyboard' | 'video' | 'audio' | 'marker';
  name: string;
  order: number;
}

export interface TimelineItem {
  id: string;
  projectId: string;
  trackId: string;
  sceneId?: string;
  assetId?: string;
  startSecond: number;
  duration: number;
  order: number;
  thumbnailPath?: string;
  label: string;
  locked: boolean;
}
```

### 7.7 Job

```ts
export interface Job {
  id: string;
  projectId: string;
  type:
    | 'SCRIPT_GENERATE'
    | 'SCRIPT_REVISE'
    | 'STORYBOARD_PROMPTS_GENERATE'
    | 'IMAGE_GENERATE'
    | 'IMAGE_REGENERATE'
    | 'STORYBOARD_STRIP_COMPOSE'
    | 'VIDEO_GENERATE'
    | 'VIDEO_REGENERATE'
    | 'EXPORT_VIDEO';
  payload: unknown;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  progress: number;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 8. SQLite 表设计

建议使用 Drizzle ORM 或 Prisma。以下用 SQL 表达核心结构。

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  aspect_ratio TEXT NOT NULL,
  resolution TEXT NOT NULL,
  default_scene_duration INTEGER NOT NULL DEFAULT 8,
  root_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  script_text TEXT,
  visual_description TEXT,
  characters_json TEXT,
  location TEXT,
  shot_size TEXT,
  camera_angle TEXT,
  camera_movement TEXT,
  motion_prompt TEXT,
  dialogue TEXT,
  audio_effects TEXT,
  duration INTEGER NOT NULL DEFAULT 8,
  status TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE storyboard_panels (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  panel_index INTEGER NOT NULL,
  role TEXT NOT NULL,
  prompt TEXT NOT NULL,
  revised_prompt TEXT,
  remote_url TEXT,
  local_path TEXT,
  status TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE video_clips (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  version INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  task_id TEXT,
  remote_url TEXT,
  local_path TEXT,
  duration INTEGER NOT NULL DEFAULT 8,
  resolution TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  input_panel_ids_json TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 9. AgentRouter 设计

Codex 适合开发期帮助写代码，不建议作为用户运行时的路由器。运行时应由本地 `AgentRouter` 管理所有任务。

### 9.1 AgentTask 类型

```ts
export type AgentTask =
  | { type: 'SCRIPT_GENERATE'; projectId: string; userPrompt: string }
  | { type: 'SCRIPT_REVISE'; projectId: string; instruction: string; sceneId?: string }
  | { type: 'STORYBOARD_PROMPTS_GENERATE'; projectId: string; sceneId: string }
  | { type: 'IMAGE_GENERATE'; projectId: string; sceneId: string; panelIndex: 0 | 1 | 2 }
  | { type: 'IMAGE_REGENERATE'; projectId: string; panelId: string; instruction: string }
  | { type: 'STORYBOARD_STRIP_COMPOSE'; projectId: string; sceneId: string }
  | { type: 'VIDEO_GENERATE'; projectId: string; sceneId: string }
  | { type: 'VIDEO_REGENERATE'; projectId: string; clipId: string; instruction: string }
  | { type: 'EXPORT_VIDEO'; projectId: string };
```

### 9.2 Router 实现骨架

```ts
export class AgentRouter {
  constructor(
    private readonly scriptService: ScriptService,
    private readonly imageService: ImageService,
    private readonly videoService: VideoService,
    private readonly storyboardService: StoryboardService,
    private readonly exportService: ExportService
  ) {}

  async run(task: AgentTask) {
    switch (task.type) {
      case 'SCRIPT_GENERATE':
        return this.scriptService.generateScript(task.projectId, task.userPrompt);

      case 'SCRIPT_REVISE':
        return this.scriptService.reviseScript(task.projectId, task.instruction, task.sceneId);

      case 'STORYBOARD_PROMPTS_GENERATE':
        return this.storyboardService.generatePanelPrompts(task.projectId, task.sceneId);

      case 'IMAGE_GENERATE':
        return this.imageService.generatePanel(task.projectId, task.sceneId, task.panelIndex);

      case 'IMAGE_REGENERATE':
        return this.imageService.regeneratePanel(task.projectId, task.panelId, task.instruction);

      case 'STORYBOARD_STRIP_COMPOSE':
        return this.storyboardService.composeStrip(task.projectId, task.sceneId);

      case 'VIDEO_GENERATE':
        return this.videoService.generateClip(task.projectId, task.sceneId);

      case 'VIDEO_REGENERATE':
        return this.videoService.regenerateClip(task.projectId, task.clipId, task.instruction);

      case 'EXPORT_VIDEO':
        return this.exportService.exportProject(task.projectId);
    }
  }
}
```

---

## 10. API 服务设计

### 10.1 项目 API

```text
POST   /api/projects
GET    /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId
```

### 10.2 聊天 / 脚本 API

```text
POST /api/projects/:projectId/chat
POST /api/projects/:projectId/script/generate
POST /api/projects/:projectId/script/revise
```

### 10.3 镜头 API

```text
GET    /api/projects/:projectId/scenes
PATCH  /api/scenes/:sceneId
POST   /api/scenes/reorder
POST   /api/scenes/:sceneId/duplicate
DELETE /api/scenes/:sceneId
```

### 10.4 故事板 API

```text
POST /api/scenes/:sceneId/storyboard/prompts
POST /api/scenes/:sceneId/storyboard/generate
POST /api/panels/:panelId/regenerate
POST /api/scenes/:sceneId/storyboard/compose-strip
```

### 10.5 视频 API

```text
POST /api/scenes/:sceneId/video/generate
POST /api/clips/:clipId/regenerate
GET  /api/clips/:clipId
POST /api/clips/:clipId/use-version
```

### 10.6 时间线 API

```text
GET  /api/projects/:projectId/timeline
POST /api/projects/:projectId/timeline/reorder
POST /api/projects/:projectId/timeline/sync
```

### 10.7 任务 API

```text
GET  /api/jobs/:jobId
GET  /api/projects/:projectId/jobs
POST /api/jobs/:jobId/cancel
```

### 10.8 导出 API

```text
POST /api/projects/:projectId/export
GET  /api/projects/:projectId/exports
```

---

## 11. GPT 脚本生成设计

### 11.1 GPT 输出必须结构化

不要让 GPT 只返回自然语言脚本。必须要求返回 JSON，方便后续生成镜头、图片和视频。

### 11.2 Script JSON Schema

```json
{
  "title": "视频标题",
  "aspectRatio": "16:9",
  "resolution": "1080p",
  "styleBible": {
    "visualStyle": "cinematic sci-fi commercial",
    "colorPalette": "blue, black, silver",
    "lightingStyle": "high contrast, premium product lighting",
    "cameraLanguage": "slow dolly, smooth pan, macro close-up",
    "characterConsistency": "same main subject in every scene",
    "negativePrompt": "low quality, blurry, distorted"
  },
  "scenes": [
    {
      "order": 1,
      "title": "产品出现",
      "summary": "透明 AI 水晶球在黑色空间中亮起。",
      "scriptText": "黑色背景里，一个透明 AI 水晶球缓缓浮现。",
      "visualDescription": "A transparent AI crystal sphere floating in a dark premium studio, glowing blue from inside.",
      "characters": ["AI crystal sphere"],
      "location": "dark premium studio",
      "shotSize": "close-up",
      "cameraAngle": "eye-level",
      "cameraMovement": "slow dolly in",
      "motionPrompt": "soft blue light pulses inside the crystal, floating particles move slowly",
      "dialogue": "未来，从一个念头开始。",
      "audioEffects": "soft digital hum",
      "duration": 8
    }
  ]
}
```

### 11.3 Prompt 模板：生成脚本

```md
你是专业广告片导演和分镜师。
请根据用户输入生成结构化视频脚本。

要求：
1. 输出 JSON，不要输出 Markdown。
2. 每个镜头 duration 固定为 8 秒。
3. 每个镜头需要包含画面描述、主体、场景、景别、机位、运镜、动态、对白、音效。
4. 所有镜头必须保持主体和风格一致。
5. 画面描述要适合后续图片生成。
6. motionPrompt 要适合后续图生视频。
7. 默认比例为 16:9，除非用户明确要求 9:16。

用户需求：
{{userPrompt}}
```

---

## 12. 三宫格故事板设计

### 12.1 为什么是三宫格

每个视频镜头固定 8 秒。为了让图生视频更稳定，每个镜头拆成 3 个关键帧：

1. 起始帧 start：镜头开始时的画面。
2. 中间帧 middle：镜头运动或动作发展中的画面。
3. 结束帧 end：镜头结束时的画面。

这 3 张图片在 UI 上拼成横向三宫格，但实际调用图生视频时传 3 张独立图片。

### 12.2 注意：不要把三宫格合成图传给视频 API

横向三宫格的比例大约是 48:9，即 5.33:1，超过 gpt-image-2 常规尺寸约束，也不适合视频模型理解。正确做法：

1. UI 显示 `storyboard-strip.png`。
2. 视频 API 输入 `panel-0.png`、`panel-1.png`、`panel-2.png`。

### 12.3 Panel Prompt 生成模板

```md
你是专业分镜师。
请为下面镜头生成 3 个关键帧图片提示词：start / middle / end。

要求：
1. 三张图必须主体一致、场景一致、风格一致。
2. start 表示镜头开始。
3. middle 表示运动发展中。
4. end 表示镜头结束。
5. 每个提示词适合 gpt-image-2 文生图。
6. 不要生成视频描述，只生成静态画面描述。
7. 输出 JSON。

项目风格：
{{styleBible}}

镜头信息：
{{scene}}
```

### 12.4 输出格式

```json
{
  "sceneId": "scene-001",
  "panels": [
    {
      "panelIndex": 0,
      "role": "start",
      "prompt": "起始帧图片提示词"
    },
    {
      "panelIndex": 1,
      "role": "middle",
      "prompt": "中间帧图片提示词"
    },
    {
      "panelIndex": 2,
      "role": "end",
      "prompt": "结束帧图片提示词"
    }
  ]
}
```

---

## 13. Packy gpt-image-2 接入设计

### 13.1 接口原则

根据 Packy GPT-Image-2 文档：

1. `gpt-image-2` 属于 Sora 分组，使用前需要创建分组为 `sora` 的令牌。
2. 出图应使用 Images API。
3. 文生图接口为 `POST https://www.packyapi.com/v1/images/generations`。
4. 图片编辑 / 图生图接口为 `POST https://www.packyapi.com/v1/images/edits`。
5. `n` 只支持 `1`，三宫格必须循环请求三次。
6. `output_format` 推荐 `png` 或 `jpeg`。
7. 不建议使用 `webp`。
8. 不支持 `transparent` 背景。
9. 不支持 `stream` 和 `partial_images`。
10. 尺寸最大边长不超过 3840，宽高为 16 的倍数，长短边比例不超过 3:1。

### 13.2 推荐图片参数

横屏项目推荐：

```json
{
  "model": "gpt-image-2",
  "size": "1536x864",
  "quality": "medium",
  "output_format": "png",
  "response_format": "url",
  "n": 1
}
```

竖屏项目推荐：

```json
{
  "model": "gpt-image-2",
  "size": "864x1536",
  "quality": "medium",
  "output_format": "png",
  "response_format": "url",
  "n": 1
}
```

正式输出可将 `quality` 改为 `high`。

### 13.3 ImageClient 骨架

```ts
export class PackyImageClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://www.packyapi.com/v1'
  ) {}

  async generateImage(input: {
    prompt: string;
    aspectRatio: '16:9' | '9:16';
    quality?: 'low' | 'medium' | 'high' | 'auto';
  }) {
    const size = input.aspectRatio === '16:9' ? '1536x864' : '864x1536';

    const res = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: input.prompt,
        size,
        quality: input.quality ?? 'medium',
        output_format: 'png',
        response_format: 'url',
        n: 1
      })
    });

    if (!res.ok) {
      throw new Error(`Image generation failed: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    return {
      url: json.data?.[0]?.url,
      revisedPrompt: json.data?.[0]?.revised_prompt
    };
  }
}
```

### 13.4 三张图循环生成

```ts
async function generateScenePanels(sceneId: string) {
  const panels = await db.storyboardPanels.findMany({ sceneId });

  for (const panel of panels) {
    if (panel.locked && panel.localPath) continue;

    await jobProgress(`Generating panel ${panel.panelIndex + 1}/3`);

    const result = await imageClient.generateImage({
      prompt: panel.prompt,
      aspectRatio: project.aspectRatio,
      quality: 'medium'
    });

    const localPath = await assetStorage.downloadToProject({
      url: result.url,
      projectId,
      sceneId,
      filename: `panel-${panel.panelIndex}.png`
    });

    await db.storyboardPanels.update(panel.id, {
      remoteUrl: result.url,
      revisedPrompt: result.revisedPrompt,
      localPath,
      status: 'ready'
    });
  }

  await storyboardComposer.composeStrip(sceneId);
}
```

---

## 14. RunningHub 图生视频接入设计

### 14.1 接口约束

根据图生视频文档：

1. 提交接口：`POST https://www.runninghub.cn/openapi/v2/rhart-video-v3.1-fast/image-to-video`
2. 查询接口：`POST https://www.runninghub.cn/openapi/v2/query`
3. 鉴权：`Authorization: Bearer ${RUNNINGHUB_API_KEY}`
4. `prompt` 必填，文本长度 5 到 8000。
5. `aspectRatio` 必填，枚举为 `16:9` 或 `9:16`。
6. `imageUrls` 必填，最多支持 3 项图片。
7. `duration` 可选，目前枚举为 `8`。
8. `resolution` 必填，支持 `720p`、`1080p`、`4k`。
9. 提交后返回 `taskId`。
10. 任务状态包括 `QUEUED`、`RUNNING`、`SUCCESS`、`FAILED`。
11. 成功结果在 `results[].url`。
12. 结果链接有效期只有 24 小时，必须立即下载到本地。
13. 输入图片可以使用公共 URL、Base64 Data URI，或通过 RunningHub 上传接口上传本地文件获取 URL。

### 14.2 VideoClient 骨架

```ts
export class RunningHubVideoClient {
  constructor(private readonly apiKey: string) {}

  async submitImageToVideo(input: {
    prompt: string;
    aspectRatio: '16:9' | '9:16';
    imageUrls: string[];
    resolution: '720p' | '1080p' | '4k';
  }) {
    const res = await fetch(
      'https://www.runninghub.cn/openapi/v2/rhart-video-v3.1-fast/image-to-video',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          prompt: input.prompt,
          aspectRatio: input.aspectRatio,
          imageUrls: input.imageUrls.slice(0, 3),
          duration: '8',
          resolution: input.resolution
        })
      }
    );

    if (!res.ok) {
      throw new Error(`Video submit failed: ${res.status} ${await res.text()}`);
    }

    return res.json();
  }

  async queryTask(taskId: string) {
    const res = await fetch('https://www.runninghub.cn/openapi/v2/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ taskId })
    });

    if (!res.ok) {
      throw new Error(`Video query failed: ${res.status} ${await res.text()}`);
    }

    return res.json();
  }
}
```

### 14.3 本地图片上传策略

图生视频接口需要 `imageUrls`。因为本项目的 panel 图片保存在本地，所以有三种策略：

#### 方案 A：使用 RunningHub 上传接口

流程：

1. 本地 panel 图片生成后保存在项目目录。
2. 调用 RunningHub 上传接口 `media/upload/binary`。
3. 获取 `download_url`。
4. 把 1 到 3 个 `download_url` 传给图生视频接口。

这是最推荐的方案。

#### 方案 B：传 Base64 Data URI

流程：

1. 读取本地图片。
2. 转成 `data:image/png;base64,...`。
3. 放进 `imageUrls` 或文档兼容字段。

这个方案简单，但请求体可能较大，不适合高分辨率图片。

#### 方案 C：本地临时文件服务

流程：

1. 本地启动临时 HTTP server。
2. 使用 ngrok / cloudflared 暴露公网地址。
3. 把公网 URL 传给视频 API。

这个方案调试复杂，不建议 MVP 使用。

### 14.4 视频生成完整流程

```ts
async function generateSceneVideo(sceneId: string) {
  const scene = await db.scenes.findById(sceneId);
  const panels = await db.storyboardPanels.findReadyByScene(sceneId);

  if (panels.length === 0) {
    throw new Error('No ready storyboard panels found');
  }

  const imageUrls = [];

  for (const panel of panels.slice(0, 3)) {
    const uploadResult = await runningHubUploader.uploadBinary(panel.localPath);
    imageUrls.push(uploadResult.download_url);
  }

  const submitResult = await videoClient.submitImageToVideo({
    prompt: buildVideoPrompt(scene),
    aspectRatio: project.aspectRatio,
    imageUrls,
    resolution: project.resolution
  });

  const clip = await db.videoClips.create({
    sceneId,
    taskId: submitResult.taskId,
    status: 'running',
    version: await nextClipVersion(sceneId)
  });

  await pollVideoTaskAndSave(clip.id, submitResult.taskId);
}
```

### 14.5 轮询与下载

```ts
async function pollVideoTaskAndSave(clipId: string, taskId: string) {
  while (true) {
    const result = await videoClient.queryTask(taskId);

    if (result.status === 'SUCCESS') {
      const videoUrl = result.results?.find((r: any) => r.outputType === 'mp4')?.url
        ?? result.results?.[0]?.url;

      const localPath = await assetStorage.downloadToProject({
        url: videoUrl,
        filename: `clip-${clipId}.mp4`
      });

      await db.videoClips.update(clipId, {
        remoteUrl: videoUrl,
        localPath,
        status: 'ready'
      });

      return;
    }

    if (result.status === 'FAILED') {
      await db.videoClips.update(clipId, {
        status: 'failed',
        error: result.errorMessage || JSON.stringify(result.failedReason)
      });
      throw new Error(result.errorMessage || 'Video generation failed');
    }

    await sleep(5000);
  }
}
```

---

## 15. 时间线设计

### 15.1 轨道设计

```ts
const tracks = [
  { id: 'storyboard', name: 'Storyboard', type: 'storyboard' },
  { id: 'video', name: 'Video', type: 'video' }
];
```

### 15.2 Item 设计

```ts
const items = [
  {
    id: 'scene-001-storyboard',
    trackId: 'storyboard',
    sceneId: 'scene-001',
    startSecond: 0,
    duration: 8,
    thumbnailPath: 'scene-001/panels/storyboard-strip.png',
    label: 'Scene 01'
  },
  {
    id: 'scene-001-video',
    trackId: 'video',
    sceneId: 'scene-001',
    assetId: 'clip-001-v1',
    startSecond: 0,
    duration: 8,
    thumbnailPath: 'scene-001/video/thumb.jpg',
    label: 'clip-v1.mp4'
  }
];
```

### 15.3 拖拽排序规则

MVP 中建议只允许按镜头块整体重排，不允许随意改变 startSecond。也就是：

1. 用户拖动 Scene 03 到 Scene 01 前面。
2. 系统重新计算所有 Scene.order。
3. Storyboard Track 和 Video Track 同步重排。
4. 每个镜头 duration 仍固定 8 秒。
5. startSecond 自动变为 `order * 8`。

### 15.4 后续高级时间线

第二阶段再支持：

1. 自定义片段时长。
2. 转场。
3. 音轨。
4. 字幕轨。
5. B-roll 素材轨。
6. 多版本 compare。

---

## 16. 前端组件设计

### 16.1 组件树

```text
<App>
  <TopBar />
  <WorkspaceLayout>
    <ChatPanel />
    <CanvasPanel>
      <SceneBoard />
      <SceneInspector />
      <StoryboardPreview />
      <VideoPreview />
    </CanvasPanel>
    <BottomTimeline />
  </WorkspaceLayout>
  <JobQueuePanel />
  <SettingsModal />
</App>
```

### 16.2 ChatPanel

状态：

```ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  action?: {
    type: 'SCRIPT_GENERATE' | 'SCRIPT_REVISE';
    jobId?: string;
  };
}
```

功能：

1. 输入创意。
2. 显示 GPT 回复。
3. 点击“生成脚本”。
4. 点击“应用到项目”。
5. 点击“生成所有故事板”。
6. 点击“生成所有视频”。

### 16.3 StoryboardPreview

功能：

1. 显示 start/middle/end 三张图。
2. 支持单图重生成。
3. 支持锁定单图。
4. 支持打开大图。
5. 支持复制 prompt。

### 16.4 BottomTimeline

功能：

1. 双轨显示。
2. 拖拽排序。
3. 点击选中 scene。
4. 右键菜单。
5. 显示任务状态。
6. 显示失败重试按钮。

---

## 17. 重生成覆盖逻辑

### 17.1 图片重生成

用户可以选择：

1. 只重生成当前 panel。
2. 重生成整个三宫格。
3. 保留已锁定 panel，只重生成未锁定 panel。

图片重生成不会自动删除旧图，而是：

```text
panel-0.png
panel-0-v2.png
panel-0-v3.png
```

数据库中 `StoryboardPanel.localPath` 指向当前版本。

### 17.2 视频重生成

视频片段重生成不能直接覆盖物理文件，应该生成新版本：

```text
clip-v1.mp4
clip-v2.mp4
clip-v3.mp4
current.json
```

`current.json` 示例：

```json
{
  "currentVersion": 2,
  "currentClipPath": "clip-v2.mp4",
  "updatedAt": "2026-06-25T12:00:00Z"
}
```

UI 上显示的是当前版本，用户可在高级菜单里切回历史版本。

---

## 18. 视频导出设计

### 18.1 使用 FFmpeg concat

生成 `concat.txt`：

```text
file '/absolute/path/to/scene-001/video/clip-v2.mp4'
file '/absolute/path/to/scene-002/video/clip-v1.mp4'
file '/absolute/path/to/scene-003/video/clip-v1.mp4'
```

执行：

```bash
ffmpeg -f concat -safe 0 -i concat.txt -c copy final.mp4
```

如果各片段编码参数不完全一致，需要转码：

```bash
ffmpeg -f concat -safe 0 -i concat.txt \
  -c:v libx264 -pix_fmt yuv420p -c:a aac final.mp4
```

### 18.2 导出前检查

1. 所有 Scene 是否有 ready 的 VideoClip。
2. 所有 VideoClip 本地文件是否存在。
3. 分辨率是否一致。
4. 比例是否一致。
5. 音频流是否一致。
6. concat 文件是否生成成功。

---

## 19. 环境变量设计

`.env.example`：

```bash
# Packy OpenAI-compatible base URL
PACKY_BASE_URL=https://www.packyapi.com/v1

# GPT chat / script model
PACKY_CHAT_API_KEY=your_chat_or_codex_group_key
PACKY_CHAT_MODEL=gpt-5.2

# gpt-image-2 requires Sora group token
PACKY_SORA_API_KEY=your_sora_group_key
PACKY_IMAGE_MODEL=gpt-image-2

# RunningHub image-to-video
RUNNINGHUB_API_KEY=your_runninghub_key

# Local project data
LOCAL_DATA_DIR=./local-data

# FFmpeg path, optional
FFMPEG_PATH=ffmpeg
```

---

## 20. Codex 开发配置

### 20.1 Codex 的定位

Codex 用于开发期：

1. 生成项目骨架。
2. 创建 TypeScript 类型。
3. 编写 API routes。
4. 编写前端组件。
5. 编写测试。
6. 重构模块。
7. 根据 AGENTS.md 执行任务。

不要把 Codex 作为用户运行时的业务路由器。

### 20.2 Packy Codex 配置要点

根据 Packy Codex 文档：

1. Windows 配置目录：`%userprofile%\.codex`
2. macOS 配置目录：`~/.codex`
3. 主要文件：`config.toml`、`auth.json`、`AGENTS.md`
4. provider base_url：`https://www.packyapi.com/v1`
5. `wire_api = "responses"`
6. `auth.json` 中写 `OPENAI_API_KEY`
7. 需要在 Packy 中创建 Codex 分组令牌

### 20.3 AGENTS.md 模板

```md
# AGENTS.md

你是本项目的 AI 视频画布开发智能体。

## 项目目标

构建一个本地运行的 AI 视频创作工具：
- 左侧聊天框：调用 GPT 生成结构化视频脚本。
- 中间画布：展示和编辑镜头、三宫格故事板、视频片段。
- 底部时间线：像剪辑工具一样展示故事板轨和视频轨。
- 用户可以对单个图片或视频片段重生成并覆盖当前版本。
- 所有生成资产必须保存到本地项目目录。

## 技术栈

- React + Vite + TypeScript
- Electron
- Node.js + Fastify
- SQLite + Drizzle ORM
- Zustand
- dnd-kit
- FFmpeg

## API 接入

- GPT 脚本：Packy OpenAI-compatible API
- 图片生成：Packy gpt-image-2 Images API
- 图生视频：RunningHub image-to-video API

## 代码规范

- 所有类型放在 packages/shared。
- API Key 只允许后端读取，不允许进入前端 bundle。
- 远程图片和视频结果必须下载到本地。
- 任务必须通过 jobs 表记录状态。
- 生成失败必须保留错误信息并支持重试。
- 不允许直接删除历史版本资产。

## 开发优先级

1. 先完成项目创建、脚本生成、Scene 保存。
2. 再完成三宫格图片生成和本地保存。
3. 再完成底部时间线展示和拖拽排序。
4. 再完成图生视频和本地保存。
5. 再完成单片段重生成覆盖。
6. 最后完成 FFmpeg 拼接导出。
```

### 20.4 Codex 任务提示词

#### 任务 1：创建项目骨架

```text
根据 AGENTS.md 创建 monorepo 项目骨架，包括 apps/web、apps/server、apps/desktop、packages/shared、packages/prompts。配置 TypeScript、Vite、Fastify、SQLite、Drizzle、Zustand。先不要实现业务，只创建可运行骨架。
```

#### 任务 2：实现共享类型

```text
根据 docs/开发方案文档.md 的数据模型，在 packages/shared/src/types.ts 和 schemas.ts 中实现 Project、Scene、StoryboardPanel、VideoClip、TimelineTrack、TimelineItem、Job 类型，并用 zod 写运行时校验。
```

#### 任务 3：实现本地存储服务

```text
实现 apps/server/src/services/storage/AssetStorageService.ts，支持创建项目目录、保存 JSON、下载远程文件到本地、生成 scene 目录、生成 panel/video 文件路径。必须包含单元测试。
```

#### 任务 4：实现脚本生成

```text
实现 ScriptService，调用 Packy GPT 接口，根据用户输入生成结构化 JSON 脚本，保存 Project、StyleBible 和 Scene 数据。要求输出严格校验，不合法时自动要求模型修复 JSON。
```

#### 任务 5：实现三宫格图片生成

```text
实现 StoryboardService 和 PackyImageClient。每个 Scene 生成 start/middle/end 三个 StoryboardPanel prompt，然后循环调用 gpt-image-2，每次 n=1，下载图片到本地，并合成 storyboard-strip.png。
```

#### 任务 6：实现底部时间线

```text
实现 BottomTimeline React 组件，参考 timeline-editor-react 的 layers/frames 思路，但使用本项目 TimelineTrack/TimelineItem 类型。支持 Storyboard Track 和 Video Track，支持拖拽重排 Scene 顺序。
```

#### 任务 7：实现图生视频

```text
实现 RunningHubVideoClient、RunningHubUploader 和 VideoService。将本地 panel 图片上传到 RunningHub，取 download_url 作为 imageUrls，最多 3 张，提交 image-to-video 任务，轮询 query 接口，成功后立即下载 mp4 到本地。
```

#### 任务 8：实现片段重生成覆盖

```text
实现 VideoClip 多版本管理。重生成时创建新版本 clip-vN.mp4，不物理覆盖旧文件；时间线默认指向最新 ready 版本；支持切换历史版本。
```

#### 任务 9：实现导出

```text
实现 ExportService，读取当前 timeline video track，生成 concat.txt，调用 FFmpeg 拼接导出 final.mp4。支持失败诊断：缺失文件、编码不一致、FFmpeg 不存在。
```

---

## 21. 开发里程碑

### Phase 0：技术验证

目标：验证 API 和本地文件链路。

交付：

1. 调用 GPT 生成结构化 JSON。
2. 调用 gpt-image-2 生成一张图。
3. 下载图片到本地。
4. 上传图片到 RunningHub。
5. 调用图生视频。
6. 轮询并下载 mp4。

验收标准：

1. 本地能生成 `panel-0.png`。
2. 本地能生成 `clip-v1.mp4`。
3. 所有 API Key 从 `.env.local` 读取。

### Phase 1：MVP 骨架

目标：完成基础产品流程。

交付：

1. 创建项目。
2. 左侧聊天生成脚本。
3. 自动创建 scenes。
4. 显示 scene 列表。
5. 编辑 scene 字段。
6. 保存到 SQLite。

### Phase 2：三宫格故事板

目标：完成每镜头三张图。

交付：

1. 生成 panel prompts。
2. 循环生成 3 张图片。
3. 本地保存图片。
4. 合成横向三宫格预览。
5. 在底部 Storyboard Track 展示。
6. 支持单 panel 重生成。

### Phase 3：时间线

目标：完成剪辑式排序体验。

交付：

1. 底部双轨时间线。
2. Storyboard Track。
3. Video Track 占位。
4. 拖拽排序。
5. 排序同步到 scenes.order。
6. 点击 timeline item 选中镜头。

### Phase 4：图生视频

目标：完成逐镜头生成视频片段。

交付：

1. 上传 panel 图片。
2. 提交图生视频任务。
3. 轮询任务状态。
4. 下载 mp4。
5. Video Track 显示视频片段。
6. 支持失败重试。

### Phase 5：重生成覆盖

目标：完成局部修复能力。

交付：

1. 单图片重生成。
2. 整个镜头三宫格重生成。
3. 单视频片段重生成。
4. 多版本保存。
5. 当前版本切换。

### Phase 6：导出

目标：导出完整视频。

交付：

1. 检查所有 clip ready。
2. 生成 concat.txt。
3. FFmpeg 拼接。
4. 导出 final.mp4。
5. 显示导出历史。

---

## 22. 测试方案

### 22.1 单元测试

重点测试：

1. JSON 脚本校验。
2. Scene 排序。
3. Timeline startSecond 计算。
4. 本地路径生成。
5. 文件下载。
6. Job 状态流转。
7. VideoClip 版本号递增。

### 22.2 集成测试

重点测试：

1. 从用户 prompt 到 scenes 创建。
2. 从 scene 到三张 panel 图片。
3. 从 panel 到 video clip。
4. 从 timeline 到 final export。

### 22.3 手动验收用例

| 用例 | 操作 | 预期 |
|---|---|---|
| 创建项目 | 输入标题和比例 | 创建本地目录和数据库 |
| 生成脚本 | 输入创意 | 出现多个 scenes |
| 生成三宫格 | 点击生成故事板 | 每个镜头 3 张图 + strip |
| 拖拽排序 | 拖动 Scene 3 到 Scene 1 前 | 顺序和 startSecond 更新 |
| 生成视频 | 点击生成所有视频 | 每个镜头生成 mp4 |
| 重生成片段 | 对 Scene 2 点击重生成 | 生成 clip-v2 并替换当前版本 |
| 导出视频 | 点击导出 | 生成 final.mp4 |

---

## 23. 风险与规避

### 23.1 图片一致性风险

风险：三张 panel 主体不一致。

规避：

1. 使用 StyleBible。
2. Prompt 中重复主体约束。
3. 后续加入参考图编辑模式。
4. 支持锁定满意 panel。

### 23.2 视频生成失败

风险：API 任务失败、排队过久、结果链接过期。

规避：

1. jobs 表保存 taskId。
2. 支持手动重试。
3. 成功后立即下载视频。
4. 错误信息完整保存。

### 23.3 时间线复杂度失控

风险：一开始做成完整剪辑软件，开发周期过长。

规避：

1. MVP 只支持镜头级排序。
2. 不支持自由裁剪。
3. 不支持转场。
4. 不支持多音轨。
5. 先固定每段 8 秒。

### 23.4 API Key 泄露

风险：前端 bundle 暴露 key。

规避：

1. API Key 只在本地后端读取。
2. 前端通过本地 API 调用。
3. 设置页仅写入本地 `.env` 或加密配置。

### 23.5 远程 URL 失效

风险：图片或视频 URL 有效期短。

规避：

1. 所有远程结果立即下载本地。
2. 数据库记录 remoteUrl 仅作为日志。
3. 预览和导出只使用 localPath。

---

## 24. MVP 最小功能清单

必须做：

1. 本地项目创建。
2. GPT 结构化脚本生成。
3. Scene 列表。
4. 每 Scene 三个 panel prompt。
5. gpt-image-2 循环生成三张图。
6. 本地保存图片。
7. 合成三宫格 strip。
8. 底部 Storyboard Track。
9. RunningHub 图生视频。
10. 本地保存 mp4。
11. Video Track 展示。
12. 单视频片段重生成。

可以后做：

1. 角色库。
2. 参考图上传。
3. 局部重绘 mask。
4. 字幕轨。
5. 音乐轨。
6. 多比例自动适配。
7. 模板市场。
8. 云端同步。

---

## 25. 第一周开发计划

### Day 1

1. 创建 monorepo。
2. 配置 Electron + React + Fastify。
3. 配置 SQLite。
4. 创建共享类型。
5. 创建 `.env.example`。

### Day 2

1. 实现 Project / Scene 数据库。
2. 实现 ChatPanel 基础 UI。
3. 实现 ScriptService。
4. 完成从用户 prompt 到 scenes 的流程。

### Day 3

1. 实现 StoryboardPanel 数据表。
2. 实现 panel prompt 生成。
3. 实现 PackyImageClient。
4. 生成单个 scene 的三张图片。

### Day 4

1. 实现 AssetStorageService。
2. 下载图片到本地。
3. 合成 storyboard-strip.png。
4. 中间画布展示三宫格。

### Day 5

1. 实现 BottomTimeline。
2. 展示 Storyboard Track。
3. 支持拖拽排序。
4. 排序写回 scenes.order。

### Day 6

1. 实现 RunningHubUploader。
2. 实现 RunningHubVideoClient。
3. 提交图生视频任务。
4. 轮询任务。
5. 下载 mp4 到本地。

### Day 7

1. 展示 Video Track。
2. 支持单片段重生成。
3. 保存多版本。
4. 修复失败重试。
5. 输出 MVP demo。

---

## 26. 结论

本项目应采用“参考开源项目但不直接 Fork”的策略：

1. 参考 AIYOU 的节点拆分、本地存储和分镜视频生成状态机。
2. 参考 timeline-editor-react 的 layers/frames 思路实现底部时间线。
3. 参考 ai_storyboard_video_generator 的脚本式流水线和 FFmpeg 合成思路。
4. 重新设计自己的产品外壳：左聊天、中画布、底部双轨时间线。
5. 运行时由本地 AgentRouter 路由任务，而不是依赖 Codex。
6. Codex 用作开发期智能体，帮助生成和维护代码。
7. 图片生成严格遵守 Packy gpt-image-2 的 Images API 约束。
8. 图生视频严格遵守 RunningHub 的 imageUrls、taskId 轮询和 24 小时链接保存要求。

最终产品的核心竞争力不是“一键生成视频”，而是“可编辑、可排序、可局部重生成的 AI 视频创作工作台”。

---

## 27. 附录：参考链接

- AIYOU_open-ai-video-drama-generator: https://github.com/yubowen123/AIYOU_open-ai-video-drama-generator
- AIYOU 本地存储设计: https://github.com/yubowen123/AIYOU_open-ai-video-drama-generator/blob/46d3a82db0cef38bc7d9deca1cf67111bb176148/docs/LOCAL_STORAGE_DESIGN.md
- AIYOU 分镜视频节点: https://github.com/yubowen123/AIYOU_open-ai-video-drama-generator/blob/46d3a82db0cef38bc7d9deca1cf67111bb176148/components/StoryboardVideoNode.tsx
- AIYOU 类型定义: https://github.com/yubowen123/AIYOU_open-ai-video-drama-generator/blob/46d3a82db0cef38bc7d9deca1cf67111bb176148/types.ts
- ai_storyboard_video_generator: https://github.com/tillo13/ai_storyboard_video_generator
- timeline-editor-react: https://github.com/kevintech/timeline-editor-react
- video-timeline-editor: https://github.com/faisalamin001/video-timeline-editor
- react-video-editor-timeline: https://github.com/phanhavn/react-video-editor-timeline
- ComfyUI: https://github.com/Comfy-Org/ComfyUI
- Packy Codex 配置: https://docs.packyapi.com/docs/cli/3-codex.html
- Packy GPT-Image-2: https://docs.packyapi.com/docs/paint/GPTImage.html
