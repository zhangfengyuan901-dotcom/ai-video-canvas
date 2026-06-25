# RunningHub VEO 图生视频 API

## Base URL

https://www.runninghub.cn/openapi/v2

## 认证

所有请求需要 Authorization: Bearer {API_KEY} 头。

## 1. 上传图片到临时存储

上传本地图片到 RunningHub 服务器，获取 download_url 用于后续视频生成。

### POST /media/upload/binary

- Content-Type: application/octet-stream
- Body: 图片原始二进制数据
- Response: `{ "download_url": "https://..." }`

### uploadBinary() — 使用示例

```ts
import { readFileSync } from "node:fs";

const buffer = readFileSync("panel-0.png");
const response = await fetch("https://www.runninghub.cn/openapi/v2/media/upload/binary", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/octet-stream",
  },
  body: buffer,
});
const { download_url } = await response.json();
```

## 2. 提交图生视频任务

### POST /rhart-video-v3.1-fast/image-to-video

```json
{
  "prompt": "motion prompt text",
  "imageUrls": ["https://...", "https://...", "https://..."],
  "aspectRatio": "16:9",
  "resolution": "720p",
  "duration": "8"
}
```

- imageUrls: 最多 3 张，从上传接口获取
- duration: 固定 8 秒
- Response: `{ "taskId": "..." }`

## 3. 查询任务状态

### POST /query

```json
{ "taskId": "..." }
```

Response:

```json
// SUCCESS
{
  "status": "SUCCESS",
  "results": [
    { "url": "https://...", "outputType": "mp4" }
  ]
}

// FAILED
{
  "status": "FAILED",
  "errorMessage": "...",
  "failedReason": {}
}
```

## 4. 下载结果

视频结果 URL 24 小时内有效。成功收到后应立即下载到本地。

```ts
// 使用 fetch + pipeline 下载到本地文件
const response = await fetch(videoUrl);
await pipeline(Readable.fromWeb(response.body), createWriteStream(localPath));
```

## 注意事项

1. imageUrls 最多 3 张，顺序对应 start/middle/end。
2. 图片必须上传到 RunningHub 临时存储，不支持外部 URL 或 Base64（但从 v3.1 开始支持）。
3. 结果 URL 24 小时有效期，必须及时下载。
4. 轮询间隔建议 5-10 秒。
5. 失败时错误信息保存在 failedReason 中。
