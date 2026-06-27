// =========================================================================
// ScriptInputPanel — 脚本输入区 + 参考图上传 + 创建脚本
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import type { ReferenceAsset } from "@ai-video-canvas/shared";

export default function ScriptInputPanel() {
  const { post, get } = useApi();
  const { currentProject, scenes, setScenes, referenceAssets, setReferenceAssets, addReferenceAsset, removeReferenceAsset, setCurrentProject } = useProjectStore();
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  // Load reference assets when project changes
  useEffect(() => {
    if (currentProject) {
      loadRefAssets();
    } else {
      setReferenceAssets([]);
    }
  }, [currentProject?.id]);

  async function loadRefAssets() {
    if (!currentProject) return;
    try {
      const data = await get<ReferenceAsset[]>(`/projects/${currentProject.id}/reference-assets`);
      setReferenceAssets(data);
    } catch {}
  }

  // Upload reference image
  async function handleUpload(type: string, file: File) {
    if (!currentProject || uploadingType) return;
    setUploadingType(type);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      const res = await fetch(`/api/projects/${currentProject.id}/reference-assets`, { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Upload failed");
      await loadRefAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingType(null);
    }
  }

  // Delete reference asset
  async function handleDeleteAsset(assetId: string) {
    if (!currentProject) return;
    try {
      await fetch(`/api/projects/${currentProject.id}/reference-assets/${assetId}`, { method: "DELETE" });
      await loadRefAssets();
    } catch {}
  }

  // Create script
  async function handleCreateScript() {
    if (!currentProject || !message.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await post<{
        title: string; aspectRatio: string; resolution: string;
        styleBible: Record<string, string>;
        scenes: Array<Record<string, unknown>>; sceneCount: number;
      }>(`/projects/${currentProject.id}/chat`, { message: message.trim() });

      setScenes(data.scenes as any);
      setCurrentProject({ ...currentProject, title: data.title, updatedAt: new Date().toISOString() });
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Script generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const assetTypes = [
    { type: "character", label: "人物" },
    { type: "scene", label: "场景" },
    { type: "product", label: "产品" },
    { type: "first_frame", label: "首帧" },
  ];

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-300">脚本输入</h3>

      {/* Text area */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={currentProject ? '输入完整脚本或创意，并上传参考图，AI 会帮你拆成分镜脚本。' : '请先创建或打开一个项目'}
        disabled={!currentProject || generating}
        rows={5}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-600 resize-none disabled:opacity-50"
      />

      {/* Reference upload grid */}
      <div className="flex gap-2 flex-wrap">
        {assetTypes.map(({ type, label }) => {
          const hasAsset = referenceAssets.some((a) => a.type === type);
          return (
            <label
              key={type}
              className={`relative flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded cursor-pointer border transition-colors ${
                hasAsset ? "bg-green-900/30 border-green-700/50 text-green-400" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <span>{hasAsset ? "✓" : "+"}</span>
              <span>{label}参考图</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingType !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(type, file);
                }}
              />
            </label>
          );
        })}
      </div>

      {/* Reference assets list */}
      {referenceAssets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {referenceAssets.map((asset) => (
            <div key={asset.id} className="flex items-center gap-1.5 bg-zinc-800/60 rounded px-2 py-1">
              <img
                src={`/api/projects/${currentProject?.id}/reference-assets/${asset.id}/image`}
                alt=""
                className="w-8 h-8 rounded object-cover"
              />
              <span className="text-[10px] text-zinc-400">{asset.type}</span>
              {asset.label && <span className="text-[10px] text-zinc-500 truncate max-w-[60px]">{asset.label}</span>}
              <button
                onClick={() => handleDeleteAsset(asset.id)}
                className="text-[10px] text-red-400 hover:text-red-300 ml-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Create button */}
      <div className="flex gap-2 items-center">
        <button
          onClick={handleCreateScript}
          disabled={!currentProject || !message.trim() || generating}
          className="text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-1.5 rounded font-medium transition-colors"
        >
          {generating ? "生成中..." : "创建脚本"}
        </button>
        {!currentProject && <p className="text-[10px] text-amber-500">请先创建或选择项目</p>}
      </div>
    </section>
  );
}