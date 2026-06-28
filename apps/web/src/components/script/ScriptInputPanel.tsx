// =========================================================================
// ScriptInputPanel — 脚本输入区 + 参考图上传 + 创建脚本 (redesigned)
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import GlassPanel from "../ui/GlassPanel";
import SectionHeader from "../ui/SectionHeader";
import GradientButton from "../ui/GradientButton";
import StatusBadge from "../ui/StatusBadge";
import LoadingState from "../ui/LoadingState";
import { ImagePlus, Sparkles, FileText, X } from "lucide-react";
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
    { type: "character", label: "人物", icon: "👤" },
    { type: "scene", label: "场景", icon: "🏙" },
    { type: "product", label: "产品", icon: "📦" },
    { type: "first_frame", label: "首帧", icon: "🎬" },
  ];

  return (
    <GlassPanel className="p-4 space-y-4">
      <SectionHeader
        title="脚本输入"
        subtitle="输入创意描述并上传参考图，AI 将拆分成可生成的分镜脚本"
      />

      {/* Text area */}
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={currentProject ? "输入完整脚本或创意描述，并上传参考图..." : "请先创建或打开一个项目"}
          disabled={!currentProject || generating}
          rows={4}
          className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/40 focus:bg-gray-700/80 resize-none disabled:opacity-50 transition-colors"
        />
        {message.trim() && (
          <div className="absolute bottom-3 right-3">
            <StatusBadge status="default" label={`${message.length} 字符`} />
          </div>
        )}
      </div>

      {/* Reference upload grid */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-2">参考图（可选）</p>
        <div className="flex gap-2 flex-wrap">
          {assetTypes.map(({ type, label, icon }) => {
            const hasAsset = referenceAssets.some((a) => a.type === type);
            return (
              <label
                key={type}
                className={`relative flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl cursor-pointer border transition-all ${
                  hasAsset
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-gray-800/80 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300"
                }`}
              >
                <span className="text-[11px]">{hasAsset ? "✓" : icon}</span>
                <span>{label}</span>
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
      </div>

      {/* Reference assets list */}
      {referenceAssets.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-2">已上传 ({referenceAssets.length})</p>
          <div className="flex flex-wrap gap-2">
            {referenceAssets.map((asset) => (
              <div key={asset.id} className="group relative flex items-center gap-2 bg-gray-700 border border-gray-700 rounded-xl p-1.5 pr-3">
                <img
                  src={`/api/projects/${currentProject?.id}/reference-assets/${asset.id}/image`}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover ring-1 ring-gray-700"
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 capitalize">{asset.type}</p>
                  {asset.label && <p className="text-[10px] text-gray-500 truncate max-w-[60px]">{asset.label}</p>}
                </div>
                <button
                  onClick={() => handleDeleteAsset(asset.id)}
                  className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-rose-400 bg-rose-600/10 border border-rose-500/10 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {/* Loading */}
      {generating && (
        <LoadingState variant="pulse" message="AI 正在分析并生成脚本..." />
      )}

      {/* Create button */}
      <div className="flex gap-3 items-center">
        <button
          onClick={handleCreateScript}
          disabled={!currentProject || !message.trim() || generating}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white px-4 py-2 text-xs font-medium transition-all hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700 disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-blue-500/20"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {generating ? "生成中..." : "创建脚本"}
        </button>
        {!currentProject && (
          <span className="text-[10px] text-amber-500/70">请先创建或选择项目</span>
        )}
        {currentProject && scenes.length > 0 && (
          <span className="text-[10px] text-gray-500">已有 {scenes.length} 个镜头，重新生成将会替换</span>
        )}
      </div>
    </GlassPanel>
  );
}
