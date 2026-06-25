# 数据模型

## 核心实体关系

```
Project 1 ─── * Scene 1 ─── 3 StoryboardPanel
                │
                └── * VideoClip
```

## Project

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string (UUID) | 主键 |
| title | string | 项目标题 |
| description | string? | 项目描述 |
| aspectRatio | "16:9" \| "9:16" | 宽高比 |
| resolution | "720p" \| "1080p" \| "4k" | 分辨率 |
| rootPath | string | 本地项目目录路径 |
| styleBibleJson | string? | JSON 格式的 StyleBible |

## Scene

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string (UUID) | 主键 |
| projectId | string | 外键 → projects |
| order | number | 排序（1-based） |
| title | string | 镜头标题 |
| summary | string | 镜头概要 |
| scriptText | string | 分镜描述文本 |
| visualDescription | string | 英文画面描述（供图片 API） |
| characters | string[] | 主体列表 |
| location | string | 场景地点 |
| shotSize | string | 景别（远景/中景/特写） |
| cameraAngle | string | 机位（平拍/俯拍/仰拍） |
| cameraMovement | string | 运镜（推/拉/摇/移/跟） |
| motionPrompt | string | 英文动态描述（供视频 API） |
| dialogue | string? | 对白/旁白 |
| audioEffects | string? | 音效 |
| duration | number | 时长（秒，默认 8） |
| status | enum | draft / storyboard_ready / video_ready / failed |
| locked | boolean | 是否锁定 |

## StoryboardPanel

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string (UUID) | 主键 |
| sceneId | string | 外键 → scenes |
| panelIndex | 0 \| 1 \| 2 | 位置索引 |
| role | "start" \| "middle" \| "end" | 角色 |
| prompt | string | 图片提示词 |
| localPath | string? | 本地图片路径 |
| remoteUrl | string? | 远程 URL（仅日志） |
| status | enum | queued / generating / ready / failed |
| locked | boolean | 锁定（重生成时保留） |

## VideoClip

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string (UUID) | 主键 |
| sceneId | string | 外键 → scenes |
| version | number | 版本号（递增） |
| taskId | string? | RunningHub 任务 ID |
| localPath | string? | 本地 mp4 路径 |
| remoteUrl | string? | 远程 mp4 URL |
| status | enum | queued / running / ready / failed |
| inputPanelIds | string[] | 使用的 panel ID 列表 |

多版本：每个版本创建独立记录，旧版本保留在数据库和磁盘中。

## Job

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string (UUID) | 主键 |
| projectId | string | 外键 → projects |
| type | enum | 任务类型 |
| status | enum | queued / running / success / failed |
| progress | number | 进度 0-100 |
| payloadJson | string | 请求参数 |
| resultJson | string? | 结果数据 |
