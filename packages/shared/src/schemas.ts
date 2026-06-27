// =========================================================================
// @ai-video-canvas/shared — zod 运行时校验 schema
// =========================================================================

import { z } from "zod";

// ---- Project -----------------------------------------------------------

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  aspectRatio: z.enum(["16:9", "9:16"]).default("16:9"),
  resolution: z.enum(["720p", "1080p", "4k"]).default("1080p"),
});

// ---- Scene -------------------------------------------------------------

export const updateSceneSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  scriptText: z.string().optional(),
  visualDescription: z.string().optional(),
  characters: z.array(z.string()).optional(),
  location: z.string().optional(),
  shotSize: z.string().optional(),
  cameraAngle: z.string().optional(),
  cameraMovement: z.string().optional(),
  motionPrompt: z.string().optional(),
  dialogue: z.string().optional(),
  audioEffects: z.string().optional(),
  locked: z.boolean().optional(),
});

export const reorderScenesSchema = z.object({
  sceneIds: z.array(z.string()).min(1),
});

// ---- Chat --------------------------------------------------------------

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
});

// ---- GPT Script Output validation ---------------------------------------

export const gptScriptSceneSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  scriptText: z.string().min(1),
  visualDescription: z.string().min(1),
  characters: z.array(z.string()),
  location: z.string(),
  shotSize: z.string(),
  cameraAngle: z.string(),
  cameraMovement: z.string(),
  motionPrompt: z.string(),
  dialogue: z.string().optional(),
  audioEffects: z.string().optional(),
  duration: z.number().default(8),
});

export const gptScriptOutputSchema = z.object({
  title: z.string().min(1),
  aspectRatio: z.enum(["16:9", "9:16"]),
  resolution: z.enum(["720p", "1080p", "4k"]),
  styleBible: z.object({
    visualStyle: z.string(),
    colorPalette: z.string(),
    lightingStyle: z.string(),
    cameraLanguage: z.string(),
    characterConsistency: z.string(),
    negativePrompt: z.string().optional(),
  }),
  scenes: z.array(gptScriptSceneSchema).min(1).max(20),
});
// ---- GPT Panel Prompts output validation --------------------------------

export const gptPanelOutputSchema = z.object({
  sceneId: z.string(),
  panels: z
    .array(
      z.object({
        panelIndex: z.number().int().min(0).max(2),
        role: z.enum(["start", "middle", "end"]),
        prompt: z.string().min(1),
      }),
    )
    .length(3),
});


// ---- Review Status API ------------------------------------------------

export const reviewStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  note: z.string().optional(),
  setCurrent: z.boolean().optional(),
});


// ---- Reference Assets --------------------------------------------------

export const referenceAssetTypeSchema = z.enum([
  "character",
  "scene",
  "product",
  "first_frame",
  "style",
  "other",
]);

export const updateReferenceAssetSchema = z.object({
  type: referenceAssetTypeSchema.optional(),
  label: z.string().optional(),
  description: z.string().optional(),
});

export const createScriptFromInputSchema = z.object({
  message: z.string().min(1).max(12000),
});

// ---- Storyboard Panel API -----------------------------------------------

export const generateStoryboardSchema = z.object({
  sceneIds: z.array(z.string()).min(1).max(20).optional(),
});

