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
- **视频生成**: RunningHub image-to-video
- **视频拼接**: FFmpeg

## API Keys

在 `.env` 中配置：

| 变量 | 说明 |
|---|---|
| `PACKY_CHAT_API_KEY` | GPT 聊天/脚本生成 (Chat 分组令牌) |
| `PACKY_SORA_API_KEY` | gpt-image-2 图片生成 (Sora 分组令牌) |
| `RUNNINGHUB_API_KEY` | RunningHub 图生视频 |

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
- Phase 4: 图生视频 — RunningHub 提交、轮询、下载、多版本
- Phase 5: 重生成覆盖 — 单片段重生成、版本管理
- Phase 6: 导出 — FFmpeg concat 拼接
