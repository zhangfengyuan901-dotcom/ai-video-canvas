// =========================================================================
// PanelPromptService — 调用 GPT 为镜头生成 3 个 panel prompt
// 每个镜头拆成 start / middle / end 三张关键帧提示词
// =========================================================================

import { gptPanelOutputSchema, type StyleBible, type Scene } from "@ai-video-canvas/shared";

const BASE_URL = process.env.PACKY_BASE_URL ?? "https://www.packyapi.com/v1";
const API_KEY = process.env.PACKY_CHAT_API_KEY ?? "";
const MODEL = process.env.PACKY_CHAT_MODEL ?? "gpt-5.2";

// ---- Prompt 模板 -------------------------------------------------------

const SYSTEM_PROMPT = `你是专业分镜师。
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
}`;

// ---- 核心方法 -----------------------------------------------------------

export async function generatePanelPrompts(
  scene: Scene,
  styleBible: Omit<StyleBible, "id" | "projectId">,
): Promise<{ panelIndex: number; role: "start" | "middle" | "end"; prompt: string }[]> {
  if (!API_KEY || API_KEY === "your_chat_group_key") {
    throw new Error("PACKY_CHAT_API_KEY is not configured in .env");
  }

  const styleText = [
    `视觉风格: ${styleBible.visualStyle}`,
    `色彩: ${styleBible.colorPalette}`,
    `布光: ${styleBible.lightingStyle}`,
    `运镜语言: ${styleBible.cameraLanguage}`,
    `主体一致性: ${styleBible.characterConsistency}`,
    styleBible.negativePrompt ? `负面提示: ${styleBible.negativePrompt}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const sceneText = [
    `镜头 ${scene.order}: ${scene.title}`,
    `画面描述: ${scene.visualDescription}`,
    `主体: ${scene.characters.join("、")}`,
    `场景: ${scene.location}`,
    `景别: ${scene.shotSize}`,
    `机位: ${scene.cameraAngle}`,
    `运镜: ${scene.cameraMovement}`,
    `动态: ${scene.motionPrompt}`,
  ].join("\n");

  const userPrompt = `项目风格：\n${styleText}\n\n镜头信息：\n${sceneText}`;

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GPT panel prompt API call failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json.choices[0].message.content);
  } catch {
    throw new Error("GPT returned invalid JSON for panel prompts");
  }

  const result = gptPanelOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Panel prompt validation failed: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  return result.data.panels;
}
