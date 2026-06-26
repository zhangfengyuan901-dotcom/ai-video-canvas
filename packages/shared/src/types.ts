// =========================================================================
// @ai-video-canvas/shared 鈥?鍓嶅悗绔叡浜暟鎹被鍨?// =========================================================================

// ---- Project -----------------------------------------------------------

export interface Project {
  id: string;
  title: string;
  description?: string;
  aspectRatio: "16:9" | "9:16";
  resolution: "720p" | "1080p" | "4k";
  defaultSceneDuration: number; // 榛樿 8
  rootPath: string;
  createdAt: string;
  updatedAt: string;
}

// ---- StyleBible --------------------------------------------------------

export interface StyleBible {
  id: string;
  projectId: string;
  visualStyle: string;
  colorPalette: string;
  lightingStyle: string;
  cameraLanguage: string;
  characterConsistency: string;
  negativePrompt?: string;
}

// ---- Scene -------------------------------------------------------------

export type SceneStatus =
  | "draft"
  | "storyboard_generating"
  | "storyboard_ready"
  | "video_generating"
  | "video_ready"
  | "failed";

export interface Scene {
  id: string;
  projectId: string;
  order: number;
  title: string;
  summary: string;
  scriptText: string;
  visualDescription: string;
  characters: string[];
  location: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  motionPrompt: string;
  dialogue?: string;
  audioEffects?: string;
  duration: number; // 榛樿 8
  status: SceneStatus;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- StoryboardPanel ---------------------------------------------------

export type PanelRole = "start" | "middle" | "end";
export type PanelStatus = "queued" | "generating" | "ready" | "failed";
export type PanelSourceType = "ai" | "upload";

export interface StoryboardPanel {
  id: string;
  projectId: string;
  sceneId: string;
  panelIndex: 0 | 1 | 2;
  role: PanelRole;
  prompt: string;
  revisedPrompt?: string;
  remoteUrl?: string;
  localPath?: string;
  sourceType?: PanelSourceType;
  originalFilename?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  status: PanelStatus;
  locked: boolean;
  version?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}


export interface RunningHubTaskUsageDto {
  consumeMoney?: string | number | null;
  consumeCoins?: string | number | null;
  taskCostTime?: string | number | null;
  thirdPartyConsumeMoney?: string | number | null;
}

export interface RunningHubTaskResultDto {
  url?: string;
  nodeId?: string;
  outputType?: string;
  text?: string | null;
}

export interface RunningHubClipDiagnostics {
  status?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  failedReason?: unknown | null;
  usage?: RunningHubTaskUsageDto | null;
  results?: RunningHubTaskResultDto[] | null;
  promptTips?: string | null;
  outputNodeId?: string | null;
  outputType?: string | null;
  taskCostTime?: string | null;
  lastPolledAt?: string | null;
  completedAt?: string | null;
}

export interface VideoClipDiagnosticsDetail {
  clipId: string;
  projectId: string;
  sceneId: string;
  version: number;
  status: ClipStatus;
  taskId?: string | null;
  diagnostics: RunningHubClipDiagnostics;
}

// ---- VideoClip ---------------------------------------------------------

export type ClipStatus = "queued" | "running" | "ready" | "failed";

export interface VideoClip {
  id: string;
  projectId: string;
  sceneId: string;
  order: number;
  version: number;
  prompt: string;
  taskId?: string;
  remoteUrl?: string;
  localPath?: string;
  duration: number;
  resolution: "720p" | "1080p" | "4k";
  aspectRatio: "16:9" | "9:16";
  inputPanelIds: string[];
  status: ClipStatus;
  error?: string;
  isCurrent?: boolean;
  diagnostics?: RunningHubClipDiagnostics;
  createdAt: string;
  updatedAt: string;
}

// ---- Timeline ----------------------------------------------------------

export type TrackType = "storyboard" | "video" | "audio" | "marker";

export interface TimelineTrack {
  id: string;
  projectId: string;
  type: TrackType;
  name: string;
  order: number;
}

export interface TimelineItem {
  id: string;
  projectId: string;
  trackId: string;
  sceneId?: string;
  assetId?: string;
  startSecond: number;
  duration: number;
  order: number;
  thumbnailPath?: string;
  label: string;
  locked: boolean;
}

// ---- Job ---------------------------------------------------------------

export type JobType =
  | "SCRIPT_GENERATE"
  | "SCRIPT_REVISE"
  | "STORYBOARD_PROMPTS_GENERATE"
  | "IMAGE_GENERATE"
  | "IMAGE_REGENERATE"
  | "STORYBOARD_STRIP_COMPOSE"
  | "VIDEO_GENERATE"
  | "VIDEO_REGENERATE"
  | "EXPORT_VIDEO";

export type JobStatus = "queued" | "running" | "success" | "failed" | "cancelled";

export interface Job {
  id: string;
  projectId: string;
  type: JobType;
  payload: unknown;
  status: JobStatus;
  progress: number;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Chat --------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  action?: {
    type: "SCRIPT_GENERATE" | "SCRIPT_REVISE";
    jobId?: string;
  };
}

// ---- GPT Script Output -------------------------------------------------

export interface GptScriptScene {
  order: number;
  title: string;
  summary: string;
  scriptText: string;
  visualDescription: string;
  characters: string[];
  location: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  motionPrompt: string;
  dialogue?: string;
  audioEffects?: string;
  duration: number;
}

export interface GptScriptOutput {
  title: string;
  aspectRatio: "16:9" | "9:16";
  resolution: "720p" | "1080p" | "4k";
  styleBible: Omit<StyleBible, "id" | "projectId">;
  scenes: GptScriptScene[];
}

// ---- API ---------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  aspectRatio?: "16:9" | "9:16";
  resolution?: "720p" | "1080p" | "4k";
}

export interface ChatRequest {
  message: string;
}
