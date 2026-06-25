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
- Native Drag & Drop
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
- 图片/视频多版本管理：每次重生成创建新文件不覆盖旧文件。
