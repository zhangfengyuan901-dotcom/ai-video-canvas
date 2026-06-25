/**
 * Phase 0 — 链路1: GPT 结构化脚本生成验证
 *
 * 调用 Packy GPT (gpt-5.2) 生成结构化视频脚本 JSON，
 * 校验格式后保存到 phase0/output/script.json。
 *
 * 运行: npx tsx phase0/verify-1-gpt-script.ts
 */

import "dotenv/config";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const BASE_URL = process.env.PACKY_BASE_URL ?? "https://www.packyapi.com/v1";
const API_KEY = process.env.PACKY_CHAT_API_KEY ?? "";
const MODEL = process.env.PACKY_CHAT_MODEL ?? "gpt-5.2";

const OUTPUT_DIR = resolve(import.meta.dirname, "output");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "script.json");

// 内置测试 prompt（中文创意）
const USER_PROMPT = `一个透明 AI 水晶球在黑色空间中缓缓浮现，内部脉冲着柔和的蓝光，漂浮粒子环绕旋转。镜头缓慢推近，水晶球突然爆发成数据流光，向四面八方扩散。整个画面充满科技感和未来感，适合科技品牌广告。`;

// ---------------------------------------------------------------------------
// Prompt 模板
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `你是专业广告片导演和分镜师。
请根据用户输入生成结构化视频脚本。

要求：
1. 只输出纯 JSON，不要输出 Markdown 代码块，不要输出任何解释文字。
2. 每个镜头 duration 固定为 8 秒。
3. 每个镜头需要包含画面描述、主体、场景、景别、机位、运镜、动态、对白、音效。
4. 所有镜头必须保持主体和风格一致。
5. visualDescription 用英文，适合后续图片生成 API；其余字段用中文。
6. motionPrompt 用英文，适合后续图生视频 API。
7. 默认比例为 16:9。
8. 生成 3-5 个镜头。

JSON Schema:
{
  "title": "视频标题",
  "aspectRatio": "16:9",
  "resolution": "1080p",
  "styleBible": {
    "visualStyle": "...",
    "colorPalette": "...",
    "lightingStyle": "...",
    "cameraLanguage": "...",
    "characterConsistency": "...",
    "negativePrompt": "..."
  },
  "scenes": [
    {
      "order": 1,
      "title": "镜头标题",
      "summary": "镜头概要",
      "scriptText": "分镜描述文本",
      "visualDescription": "英文画面描述，适合图片生成",
      "characters": ["主体"],
      "location": "场景地点",
      "shotSize": "景别",
      "cameraAngle": "机位",
      "cameraMovement": "运镜",
      "motionPrompt": "英文动态描述，适合图生视频",
      "dialogue": "对白或旁白",
      "audioEffects": "音效",
      "duration": 8
    }
  ]
}`;

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  // 检查 API Key
  if (!API_KEY || API_KEY === "your_chat_group_key") {
    console.error("❌ 请在 .env 中设置 PACKY_CHAT_API_KEY");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════");
  console.log("  Phase 0 · 链路1: GPT 脚本生成验证");
  console.log("═══════════════════════════════════════════");
  console.log(`  Model: ${MODEL}`);
  console.log(`  API:   ${BASE_URL}/chat/completions`);
  console.log("");

  // 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Step 1: 调用 GPT
  console.log("▶ 正在调用 GPT 生成脚本...");
  const startTime = Date.now();

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
        { role: "user", content: USER_PROMPT },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`❌ API 调用失败 (${response.status}): ${body}`);
    process.exit(1);
  }

  const json = (await response.json()) as {
    choices: { message: { content: string } }[];
    usage: { total_tokens: number; prompt_tokens: number; completion_tokens: number };
  };

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  ✓ GPT 返回成功 (${elapsed}s)`);

  // Step 2: 解析 JSON
  console.log("▶ 正在解析并校验脚本 JSON...");

  let script: unknown;
  try {
    script = JSON.parse(json.choices[0].message.content);
  } catch {
    console.error("❌ GPT 返回的内容不是合法 JSON:");
    console.error(json.choices[0].message.content.slice(0, 500));
    process.exit(1);
  }

  // Step 3: 基础校验
  const s = script as Record<string, unknown>;
  const checks: [string, boolean][] = [
    ["title 存在", typeof s.title === "string" && s.title.length > 0],
    ["scenes 是数组", Array.isArray(s.scenes) && s.scenes.length > 0],
    ["styleBible 存在", typeof s.styleBible === "object" && s.styleBible !== null],
  ];

  let allOk = true;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (!ok) allOk = false;
  }

  if (!allOk) {
    console.error("❌ 脚本校验未通过，请检查 GPT 输出。");
    process.exit(1);
  }

  // Step 4: 保存到本地
  console.log("▶ 正在保存脚本 JSON...");
  writeFileSync(OUTPUT_FILE, JSON.stringify(script, null, 2), "utf-8");

  console.log(`  ✓ 已保存到: ${OUTPUT_FILE}`);

  // 打印摘要
  const scenes = s.scenes as Array<Record<string, unknown>>;
  console.log("");
  console.log("───────────────────────────────────────────");
  console.log(`  标题: ${s.title}`);
  console.log(`  镜头数: ${scenes.length}`);
  scenes.forEach((scene) => {
    console.log(`    Scene ${scene.order}: ${scene.title} [${scene.shotSize}]`);
  });
  console.log("───────────────────────────────────────────");
  console.log(`  Token 用量: ${json.usage.total_tokens} (prompt ${json.usage.prompt_tokens} + completion ${json.usage.completion_tokens})`);
  console.log("");
  console.log("✅ 链路1 验证通过！");
}

main().catch((err) => {
  console.error("❌ 未预期的错误:", err);
  process.exit(1);
});
