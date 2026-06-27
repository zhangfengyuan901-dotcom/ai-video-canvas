// =========================================================================
// CanvasPanel — 中间画布 / 项目操作区 (redesigned)
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../hooks/useApi";
import { useProjectStore } from "../../stores/projectStore";
import GlassPanel from "../ui/GlassPanel";
import SectionHeader from "../ui/SectionHeader";
import GradientButton from "../ui/GradientButton";
import EmptyState from "../ui/EmptyState";
import { FolderPlus, Film, Search } from "lucide-react";
import SceneList from "../scene/SceneList";
import ProjectProgressPanel from "../project/ProjectProgressPanel";
import ScriptInputPanel from "../script/ScriptInputPanel";
import ScriptPreviewPanel from "../script/ScriptPreviewPanel";
import type { Project } from "@ai-video-canvas/shared";

export default function CanvasPanel() {
  const { post, get } = useApi();
  const { projects, currentProject, scenes, createProject, setCurrentProject, setProjects, setScenes } = useProjectStore();
  const [newTitle, setNewTitle] = useState("");
  const [newAspectRatio, setNewAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [newResolution, setNewResolution] = useState<"720p" | "1080p" | "4k">("1080p");
  const [busy, setBusy] = useState(false);

  // Load projects on mount
  useEffect(() => {
    get<Project[]>("/projects")
      .then((list) => setProjects(list))
      .catch((err) => console.error("Failed to load projects:", err));
  }, []);

  // Fetch scenes when project changes
  const loadScenes = useCallback(async (projectId: string) => {
    try {
      const list = await get<any[]>(`/projects/${projectId}/scenes`);
      setScenes(list as any);
    } catch (err) {
      console.error("Failed to load scenes:", err);
    }
  }, [get, setScenes]);

  useEffect(() => {
    if (currentProject) {
      loadScenes(currentProject.id);
    }
  }, [currentProject?.id]);

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const p = await post<Project>("/projects", { title, aspectRatio: newAspectRatio, resolution: newResolution });
      createProject(p);
      setNewTitle("");
      setNewAspectRatio("16:9");
      setNewResolution("1080p");
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
      {/* Toolbar */}
      <div className="h-11 border-b border-white/[0.06] bg-white/[0.02] flex items-center px-4 gap-3 shrink-0">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">画布</span>
        <div className="flex-1" />

        {/* Project selector */}
        {projects.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Search className="h-3 w-3 text-zinc-600" />
            <select
              value={currentProject?.id ?? ""}
              onChange={(e) => {
                const p = projects.find((p) => p.id === e.target.value);
                setCurrentProject(p ?? null);
                if (p) loadScenes(p.id);
              }}
              className="bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2.5 py-1 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
            >
              <option value="">选择项目...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Create new project */}
        <div className="flex gap-1.5 items-center">
          <select
            value={newAspectRatio}
            onChange={(e) => setNewAspectRatio(e.target.value as "16:9" | "9:16")}
            className="bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-1.5 py-1 text-xs text-zinc-400 focus:outline-none focus:border-blue-500/50 w-14 appearance-none cursor-pointer"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
          <select
            value={newResolution}
            onChange={(e) => setNewResolution(e.target.value as "720p" | "1080p" | "4k")}
            className="bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-1.5 py-1 text-xs text-zinc-400 focus:outline-none focus:border-blue-500/50 w-16 appearance-none cursor-pointer"
          >
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="4k">4K</option>
          </select>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="新项目名称"
            className="w-28 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={handleCreate}
            disabled={busy || !newTitle.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 text-white px-3 py-1 text-xs font-medium transition-all hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700 disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-blue-500/20"
          >
            <FolderPlus className="h-3 w-3" />
            {busy ? "创建中..." : "创建"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!currentProject ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={<Film className="h-10 w-10" />}
              title="开始您的 AI 视频创作"
              message="创建或选择一个项目，然后在左侧输入创意描述或完整的视频脚本。AI 将自动将其拆分为分镜脚本、生成三视图素材，并最终转化为视频。"
              action={
                <div className="mt-2 text-[11px] text-zinc-600">
                  选择已有项目，或在上方输入名称并点击「创建」
                </div>
              }
            />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto p-5 lg:p-6 space-y-5">
            {/* Project header */}
            <GlassPanel className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
                    {currentProject.title}
                    {scenes.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-zinc-500">
                        · {scenes.length} 个镜头
                      </span>
                    )}
                  </h2>
                  <div className="flex gap-3 mt-1 text-[11px] text-zinc-500">
                    <span>{currentProject.aspectRatio}</span>
                    <span>{currentProject.resolution}</span>
                    <span>
                      创建于 {new Date(currentProject.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </GlassPanel>

            {/* Script Input Section */}
            <ScriptInputPanel />

            {/* Script Preview Section (when scenes exist) */}
            {scenes.length > 0 && <ScriptPreviewPanel />}

            {/* Project progress */}
            <ProjectProgressPanel />

            {/* Scenes */}
            <section>
              <SectionHeader
                title="镜头列表"
                count={scenes.length}
                subtitle="展开每个镜头查看三图素材、视频版本和编辑详情"
              />
              {scenes.length > 0 ? (
                <div className="mt-3">
                  <SceneList />
                </div>
              ) : (
                <GlassPanel className="p-4 mt-3">
                  <EmptyState
                    compact
                    icon={<Film className="h-6 w-6" />}
                    title="还没有镜头"
                    message="在左侧输入视频创意，点击「创建脚本」即可生成分镜脚本"
                  />
                </GlassPanel>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
