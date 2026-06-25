# Prompt 设计指南

## 层次结构

每个 AI 生成环节使用 3 层 prompt 策略：

### 1. 系统层（System Prompt）
定义角色、任务目标、输出格式约束。固定在代码中，不用户输入。

### 2. 项目层（StyleBible）
GPT 脚本生成时自动提取，包含视觉风格、色彩、布光、运镜语言、主体一致性约束。传递给后续 prompt 保证风格一致。

### 3. 镜头层（Scene Context）
每次生成时动态构建，包含当前镜头的画面描述、主体、景别、机位、运镜等。

## Prompt 流

```
用户输入创意
  ↓
GPT (system + user) → 结构化脚本 + StyleBible
  ↓
PanelPrompt GPT (system + styleBible + scene) → 3 个 panel prompts
  ↓
gpt-image-2 (3 次，n=1) → 3 张 panel 图片
  ↓
RunningHub VEO (motionPrompt + panel 图片) → 视频片段
```

## 英文 vs 中文

- scene.visualDescription → 英文，供 gpt-image-2 文生图
- scene.motionPrompt → 英文，供 RunningHub 图生视频
- 其余字段（title、summary、shotSize 等）→ 中文，供 UI 展示
