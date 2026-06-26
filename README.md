# AI 视频画布

本地运行的 AI 视频脚本 / 故事板 / 图生视频画布工具。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│ 顶部工具栏：项目名 / API 状态 / 导出                         │
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

## 快速开始

```bash
# 安装依赖
npm install

# 复制环境变量
cp .env.example .env
# 编辑 .env 填入 API Key

# 初始化数据库
npm run db:push -w apps/server

# 启动开发服务器（前后端并行）
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:3001

## 技术栈

- **前端**: React + Vite + TypeScript + Tailwind + Zustand
- **后端**: Node.js + Fastify + SQLite + Drizzle ORM
- **图片生成**: Packy gpt-image-2
- **视频生成**: RunningHub AI App workflow
- **视频拼接**: FFmpeg

## API Keys

在 `.env` 中配置：

| 变量 | 说明 |
|---|---|
| `PACKY_CHAT_API_KEY` | GPT 聊天/脚本生成 (Chat 分组令牌) |
| `PACKY_SORA_API_KEY` | gpt-image-2 图片生成 (Sora 分组令牌) |
| `RUNNINGHUB_API_KEY` | RunningHub AI App 视频生成 |
| `RUNNINGHUB_SUBMIT_URL` | RunningHub AI App 提交地址（可选） |
| `RUNNINGHUB_QUERY_URL` | RunningHub 任务查询地址（可选） |
| `RUNNINGHUB_UPLOAD_URL` | RunningHub 文件上传地址（可选） |

### RunningHub AI App 视频生成

当前视频生成使用 RunningHub AI App 工作流：

```env
RUNNINGHUB_SUBMIT_URL=https://www.runninghub.cn/openapi/v2/run/ai-app/2037453629342355457
RUNNINGHUB_QUERY_URL=https://www.runninghub.cn/openapi/v2/query
RUNNINGHUB_UPLOAD_URL=https://www.runninghub.cn/openapi/v2/media/upload/binary
```

生成流程：

1. 本地 storyboard panel 生成完成
2. 后端通过 RunningHub media upload 上传 panel 图片
3. 上传接口返回临时 `download_url`
4. 后端把图片 URL 写入 AI App `nodeInfoList`
5. RunningHub 返回 `taskId`
6. 后台轮询 `/openapi/v2/query`
7. 任务成功后立即下载结果到本地，避免 24 小时链接过期

当前 AI App 节点映射：

| 输入 | 节点 |
| ------ | ------------------------------ |
| 图像 1-9 | 2, 7, 8, 9, 10, 11, 12, 13, 14 |
| 视频 1-3 | 3, 17, 20 |
| 音频 1-3 | 27, 28, 29 |
| 参数 | nodeId=1 |


### RunningHub 诊断信息持久化

视频生成任务完成后，后端会保存 RunningHub 返回的诊断信息到 `video_clips`：

| 字段 | 说明 |
| --- | --- |
| `runninghub_status` | RunningHub 原始任务状态 |
| `runninghub_error_code` | RunningHub 错误码 |
| `runninghub_error_message` | RunningHub 错误信息 |
| `runninghub_failed_reason_json` | RunningHub failedReason 原始 JSON |
| `runninghub_usage_json` | RunningHub usage 原始 JSON |
| `runninghub_results_json` | RunningHub results 原始 JSON |
| `runninghub_prompt_tips` | ComfyUI prompt 校验信息 |
| `runninghub_output_node_id` | 选中的输出节点 ID |
| `runninghub_output_type` | 选中的输出类型，如 mp4 |
| `runninghub_task_cost_time` | RunningHub 返回的任务耗时 |
| `last_polled_at` | 最近一次轮询时间 |
| `completed_at` | 任务完成时间 |

### 视频诊断 API

视频列表接口会返回诊断摘要：

```http
GET /api/projects/:projectId/videos
GET /api/projects/:projectId/scenes/:sceneId/videos
```

每个 `VideoClip` 包含：

```ts
diagnostics?: {
  status?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  outputNodeId?: string | null;
  outputType?: string | null;
  taskCostTime?: string | null;
  lastPolledAt?: string | null;
  completedAt?: string | null;
}
```

完整诊断信息可通过：

```http
GET /api/projects/:projectId/scenes/:sceneId/videos/:clipId/diagnostics
```

该接口返回完整 `usage / results / failedReason / promptTips`，用于排查 RunningHub AI App 任务失败、确认输出节点和分析任务耗时。

前端视频版本区会显示 RunningHub 诊断摘要，可展开查看任务 ID、错误码、输出节点、输出类型、耗时、最近轮询时间和失败原因摘要。


这些字段用于排查工作流失败、确认输出节点和分析任务消耗。

## 目录结构

```
ai-video-canvas/
├── apps/
│   ├── web/           # React 前端
│   ├── server/        # Fastify 后端 API
│   └── desktop/       # Electron 壳（待完善）
├── packages/
│   ├── shared/        # 前后端共享类型 & zod schemas
│   └── prompts/       # Prompt 模板（待完善）
├── local-data/        # 运行时数据（已 gitignore）
└── docs/              # 文档
```

## 开发里程碑

- Phase 0: 技术验证
- Phase 1: MVP 骨架 — 项目创建、脚本生成、Scene 保存
- Phase 2: 三宫格故事板 — Panel 生成、本地保存、strip 合成
- Phase 3: 时间线 — 双轨展示、拖拽排序
- Phase 4: 视频生成 — RunningHub AI App 提交、轮询、下载、多版本
- Phase 5: 重生成覆盖 — 单片段重生成、版本管理
- Phase 6: 导出 — FFmpeg concat 拼接
- Phase 4+: 诊断持久化 — 保存 RunningHub 任务状态、usage、results、轮询记录
