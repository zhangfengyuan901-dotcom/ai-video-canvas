// =========================================================================
// ShotEditor — 底部镜头编辑器，支持最小化收折
// =========================================================================

import { useCallback, useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import { Image, Video, Play, ChevronUp, ChevronDown, GripHorizontal } from "lucide-react";
import type { Scene } from "@ai-video-canvas/shared";

interface ShotEditorProps {
  scene: Scene;
}

export default function ShotEditor({ scene }: ShotEditorProps) {
  const api = useApi();
  const scenes = useProjectStore((s) => s.scenes);
  const setScenes = useProjectStore((s) => s.setScenes);
  const currentProject = useProjectStore((s) => s.currentProject);
  const isGeneratingStoryboard = useProjectStore((s) => s.isGeneratingStoryboard);
  const isGeneratingVideo = useProjectStore((s) => s.isGeneratingVideo);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const sceneIndex = scenes.findIndex((s) => s.id === scene.id);

  const handleFieldChange = useCallback(
    async (field: keyof Scene, value: string | number) => {
      setSaving(true);
      setScenes(scenes.map((s) => (s.id === scene.id ? { ...s, [field]: value } : s)));
      try { await api.patch(`/scenes/${scene.id}`, { [field]: value }); } catch (err) { console.error(err); }
      finally { setSaving(false); }
    },
    [scene.id, scenes, setScenes, api],
  );

  async function handleRegenImage() {
    if (!currentProject || isGeneratingStoryboard) return;
    useProjectStore.getState().setGeneratingStoryboard(true);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/storyboard/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneIds: [scene.id] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Generation failed");
      const jobId = json.data?.jobId;
      if (jobId) {
        const poll = setInterval(async () => {
          try {
            const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json());
            if (job.data?.status === "success" || job.data?.status === "failed" || job.data?.status === "cancelled") {
              clearInterval(poll); useProjectStore.getState().setGeneratingStoryboard(false);
              if (job.data?.status === "success" && currentProject) {
                const p = await fetch(`/api/projects/${currentProject.id}/scenes/${scene.id}/panels`).then(r => r.json());
                if (p.success) useProjectStore.getState().setPanels(scene.id, p.data);
              }
            }
          } catch { clearInterval(poll); useProjectStore.getState().setGeneratingStoryboard(false); }
        }, 2000);
      }
    } catch (err) { console.error(err); useProjectStore.getState().setGeneratingStoryboard(false); }
  }

  async function handleRegenVideo() {
    if (!currentProject || isGeneratingVideo) return;
    useProjectStore.getState().setGeneratingVideo(true);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/videos/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneIds: [scene.id] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Generate failed");
      const jobId = json.data?.jobId;
      if (jobId) {
        const poll = setInterval(async () => {
          try {
            const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json());
            if (job.data?.status === "success" || job.data?.status === "failed" || job.data?.status === "cancelled") {
              clearInterval(poll); useProjectStore.getState().setGeneratingVideo(false);
            }
          } catch { clearInterval(poll); useProjectStore.getState().setGeneratingVideo(false); }
        }, 2000);
      }
    } catch (err) { console.error(err); useProjectStore.getState().setGeneratingVideo(false); }
  }

  // ---- 最小化状态：仅显示一行工具栏 ----
  if (collapsed) {
    return (
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-1.5 shrink-0 z-10 flex items-center gap-3">
        <button onClick={() => setCollapsed(false)} className="text-gray-500 hover:text-gray-300 transition" title="展开">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <GripHorizontal className="h-3 w-3 text-gray-600 shrink-0" />
        <span className="text-xs font-medium text-gray-400 shrink-0">
          Shot #{sceneIndex >= 0 ? sceneIndex + 1 : "?"}
        </span>
        <span className="text-[10px] text-gray-600 truncate flex-1">{scene.scriptText || scene.title || "—"}</span>
        {saving && <span className="text-[10px] text-blue-400 animate-pulse shrink-0">saving...</span>}
        <button onClick={handleRegenImage} disabled={isGeneratingStoryboard}
          className="text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-0.5 rounded border border-gray-600 transition disabled:opacity-50 shrink-0">
          <Image className="h-3 w-3 inline mr-1" />Regen
        </button>
        <button onClick={handleRegenVideo} disabled={isGeneratingVideo}
          className="text-[10px] bg-purple-600/50 hover:bg-purple-600 text-purple-300 px-2 py-0.5 rounded border border-purple-500/50 transition disabled:opacity-50 shrink-0">
          <Video className="h-3 w-3 inline mr-1" />Regen
        </button>
      </div>
    );
  }

  // ---- 展开状态 ----
  return (
    <div className="bg-gray-800 border-t border-gray-700 shrink-0 z-10">
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed(true)} className="text-gray-500 hover:text-gray-300 transition" title="最小化">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <h3 className="font-semibold text-sm text-gray-200">
            Shot #{sceneIndex >= 0 ? sceneIndex + 1 : "?"} Settings
          </h3>
          {saving && <span className="text-[10px] text-blue-400 animate-pulse font-normal">saving...</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={handleRegenImage} disabled={isGeneratingStoryboard}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded border border-gray-600 transition disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1">
            <Image className="h-3 w-3" /> Regen Image
          </button>
          <button onClick={handleRegenVideo} disabled={isGeneratingVideo}
            className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded border border-purple-500 transition disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1">
            <Video className="h-3 w-3" /> Regen Video
          </button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4 max-h-[220px] overflow-y-auto">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Shot Description / Script</label>
            <textarea value={(scene.scriptText as string) ?? ""} onChange={(e) => handleFieldChange("scriptText", e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none h-20 resize-none placeholder-gray-500" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Camera Move</label>
              <select value={(scene.cameraMovement as string) ?? "static"} onChange={(e) => handleFieldChange("cameraMovement", e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                <option value="static">Static</option>
                <option value="pan_left">Pan Left</option>
                <option value="pan_right">Pan Right</option>
                <option value="zoom_in">Zoom In</option>
                <option value="zoom_out">Zoom Out</option>
                <option value="tracking">Tracking Shot</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Duration (s)</label>
              <input type="number" value={scene.duration ?? 5} onChange={(e) => handleFieldChange("duration", Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Dialogue / Voiceover</label>
            <textarea value={(scene.dialogue as string) ?? ""} onChange={(e) => handleFieldChange("dialogue", e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none h-20 resize-none placeholder-gray-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Background Music / SFX</label>
            <div className="flex gap-2">
              <select value={(scene.audioEffects as string) ?? "none"} onChange={(e) => handleFieldChange("audioEffects", e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                <option value="none">None</option>
                <option value="ambient_cyber">Ambient Cyber</option>
                <option value="orchestral">Orchestral Hit</option>
                <option value="rain">Rain &amp; Thunder</option>
              </select>
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 rounded border border-gray-600 transition"><Play className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
