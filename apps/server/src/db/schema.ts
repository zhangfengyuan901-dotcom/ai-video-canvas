// =========================================================================
// Drizzle ORM Schema -- Phase 4: +video_clips
// =========================================================================

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ---- projects ----------------------------------------------------------

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  resolution: text("resolution").notNull().default("1080p"),
  defaultSceneDuration: integer("default_scene_duration").notNull().default(8),
  rootPath: text("root_path").notNull(),
  styleBibleJson: text("style_bible_json"),
  createdAt: text("created_at").notNull(),
 updatedAt: text("updated_at").notNull(),
});

// ---- scenes ------------------------------------------------------------

export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  order: integer("order_index").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  scriptText: text("script_text").notNull().default(""),
  visualDescription: text("visual_description").notNull().default(""),
  charactersJson: text("characters_json").notNull().default("[]"),
  location: text("location").notNull().default(""),
  shotSize: text("shot_size").notNull().default(""),
  cameraAngle: text("camera_angle").notNull().default(""),
  cameraMovement: text("camera_movement").notNull().default(""),
  motionPrompt: text("motion_prompt").notNull().default(""),
  dialogue: text("dialogue"),
  audioEffects: text("audio_effects"),
  duration: integer("duration").notNull().default(8),
  status: text("status").notNull().default("draft"),
  locked: integer("locked").notNull().default(0),
  currentClipId: text("current_clip_id"),
  storyboardReviewStatus: text("storyboard_review_status").notNull().default("pending"),
  storyboardReviewNote: text("storyboard_review_note"),
  storyboardApprovedAt: text("storyboard_approved_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ---- storyboard_panels -------------------------------------------------

export const storyboardPanels = sqliteTable("storyboard_panels", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  sceneId: text("scene_id").notNull(),
  panelIndex: integer("panel_index").notNull(),
  role: text("role").notNull(),
  prompt: text("prompt").notNull(),
  revisedPrompt: text("revised_prompt"),
  remoteUrl: text("remote_url"),
  localPath: text("local_path"),
  sourceType: text("source_type").notNull().default("ai"),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  width: integer("width"),
  height: integer("height"),
  status: text("status").notNull().default("queued"),
  locked: integer("locked").notNull().default(0),
  version: integer("version").notNull().default(1),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ---- video_clips (Phase 4) --------------------------------------------

export const videoClips = sqliteTable("video_clips", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  sceneId: text("scene_id").notNull(),
  order: integer("order_index").notNull(),
  version: integer("version").notNull().default(1),
  prompt: text("prompt").notNull().default(""),
  taskId: text("task_id"),
  remoteUrl: text("remote_url"),
 localPath: text("local_path"),
  retryOfClipId: text("retry_of_clip_id"),
  retryReason: text("retry_reason"),
  retryCreatedAt: text("retry_created_at"),
  runninghubStatus: text("runninghub_status"),
  runninghubErrorCode: text("runninghub_error_code"),
  runninghubErrorMessage: text("runninghub_error_message"),
  runninghubFailedReasonJson: text("runninghub_failed_reason_json"),
  runninghubUsageJson: text("runninghub_usage_json"),
  runninghubResultsJson: text("runninghub_results_json"),
  runninghubPromptTips: text("runninghub_prompt_tips"),
  runninghubOutputNodeId: text("runninghub_output_node_id"),
  runninghubOutputType: text("runninghub_output_type"),
  runninghubTaskCostTime: text("runninghub_task_cost_time"),
  lastPolledAt: text("last_polled_at"),
  completedAt: text("completed_at"),
 inputPanelIdsJson: text("input_panel_ids_json").notNull().default("[]"),
 duration: integer("duration").notNull().default(8),
  resolution: text("resolution").notNull().default("720p"),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  reviewStatus: text("review_status").notNull().default("pending"),
  reviewNote: text("review_note"),
  approvedAt: text("approved_at"),
  rejectedAt: text("rejected_at"),
  createdAt: text("created_at").notNull(),
 updatedAt: text("updated_at").notNull(),
});

 // ---- jobs (Phase 4) -------------------------------------------------

 export const jobs = sqliteTable("jobs", {
   id: text("id").primaryKey(),
   projectId: text("project_id").notNull(),
   type: text("type").notNull(),
   payloadJson: text("payload_json").notNull().default("{}"),
   status: text("status").notNull().default("queued"),
   progress: integer("progress").notNull().default(0),
   resultJson: text("result_json"),
   error: text("error"),
   taskId: text("task_id"),
   createdAt: text("created_at").notNull(),
   updatedAt: text("updated_at").notNull(),
 });
