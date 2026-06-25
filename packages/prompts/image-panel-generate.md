# 图片生成 Prompt 设计

## 接口约束（gpt-image-2）
- 每次调用 n=1
- 尺寸取决于 aspectRatio: 16:9 → 1536x864, 9:16 → 864x1536
- quality: medium 或 high
- output_format: png
- response_format: url

## Prompt 结构

一个 panel prompt 包含以下层次：

1. **主体描述** — 核心对象、角色、动作
2. **场景环境** — 地点、时间、氛围
3. **景别与构图** — 远景/中景/特写、主体位置
4. **光照与色彩** — 布光风格、色调
5. **风格参考** — 美术风格（从 StyleBible 获取）

## 示例

```
A majestic lion standing on a rocky outcrop at sunset, golden hour light,
epic wide shot, cinematic composition, warm orange and gold color palette,
photorealistic, highly detailed, dramatic clouds in the background
```

## 负面提示（StyleBible.negativePrompt）

如果配置了负面提示，附加到每个 panel prompt 末尾作为排除项。
