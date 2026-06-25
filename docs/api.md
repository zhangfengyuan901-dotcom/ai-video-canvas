# API 文档

Base URL: `http://localhost:3001/api`

## 项目

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /projects | 列出所有项目 |
| POST | /projects | 创建项目 |
| GET | /projects/:id | 获取单个项目 |
| PATCH | /projects/:id | 更新项目 |

### POST /projects

```json
{
  "title": "项目标题",
  "aspectRatio": "16:9",
  "resolution": "1080p"
}
```

## 聊天 / 脚本生成

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /projects/:id/chat | 发送创意生成脚本 |

### POST /projects/:id/chat

```json
{ "message": "一段关于咖啡的短视频" }
```

返回脚本包含 scenes、styleBible、title、aspectRatio、resolution。

## 镜头

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /projects/:pid/scenes | 获取项目所有镜头 |
| PATCH | /scenes/:id | 更新镜头字段 |
| POST | /scenes/reorder | 重排镜头顺序 |

### POST /scenes/reorder

```json
{ "sceneIds": ["id3", "id1", "id2"] }
```

## 故事板

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /projects/:pid/storyboard/generate | 生成故事板图片 |
| GET | /projects/:pid/scenes/:sid/panels | 获取镜头三格图 |
| POST | /projects/:pid/scenes/:sid/panels/:index/regenerate | 重生成单张 panel |
| GET | /projects/:pid/scenes/:sid/panels/:index/image | 获取 panel 图片 |
| GET | /projects/:pid/scenes/:sid/strip | 获取三宫格 strip |

## 视频

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /projects/:pid/videos/generate | 提交图生视频任务 |
| GET | /projects/:pid/videos | 获取项目所有视频 |
| GET | /projects/:pid/scenes/:sid/videos | 获取镜头所有版本视频 |
| GET | /projects/:pid/scenes/:sid/videos/:vid/video | 播放视频文件（支持 Range） |
| GET | /projects/:pid/videos/check-key | 检查 API Key |

## 导出

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /projects/:pid/export | 导出完整视频（FFmpeg concat） |
| GET | /projects/:pid/exports | 列出历史导出文件 |

## 健康检查

GET /api/health → `{ "status": "ok", "timestamp": "..." }`
