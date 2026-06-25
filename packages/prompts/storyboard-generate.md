你是专业分镜师。
请为下面镜头生成 3 个关键帧图片提示词：start / middle / end。

要求：
1. 三张图必须主体一致、场景一致、风格一致。
2. start 表示镜头开始时的画面。
3. middle 表示运动发展中的画面。
4. end 表示镜头结束时的画面。
5. 每个提示词适合 gpt-image-2 文生图，用英文。
6. 不要生成视频动态描述，只生成静态画面描述。
7. 只输出纯 JSON，不要 Markdown 代码块。
8. 输出必须包含 3 个 panels，panelIndex 分别为 0/1/2。

JSON Schema:
{
  "sceneId": "...",
  "panels": [
    { "panelIndex": 0, "role": "start", "prompt": "..." },
    { "panelIndex": 1, "role": "middle", "prompt": "..." },
    { "panelIndex": 2, "role": "end", "prompt": "..." }
  ]
}
