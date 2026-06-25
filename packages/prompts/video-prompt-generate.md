# 视频生成 Prompt 设计

## 接口约束（RunningHub VEO 3.1）
- imageUrls: 最多 3 张图片 URL
- duration: 固定 8 秒
- resolution: 720p / 1080p
- aspectRatio: 16:9 / 9:16

## Prompt 结构

视频 motion prompt 应描述镜头运动，区别于静态图片 prompt：

1. **镜头运动** — 推、拉、摇、移、跟、升、降
2. **主体动作** — 角色/物体在时间轴上的变化
3. **环境动态** — 粒子、光照变化、天气
4. **节奏与速度** — 慢速/正常/快速

## 示例

```
Slow push-in towards the lion, gentle camera movement,
subtle cloud motion in background, warm golden light shimmering,
cinematic 24fps feel, smooth transition
```
