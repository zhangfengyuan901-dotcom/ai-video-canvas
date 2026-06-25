// =========================================================================
// CanvasPanel — 中间画布 / 项目操作区
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../hooks/useApi";
import { useProjectStore } from "../../stores/projectStore";
import SceneList from "../scene/SceneList";
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
    <main className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 border-b border-zinc-800 flex items-center px-4 gap-3 shrink-0">
        <span className="text-xs font-medium text-zinc-400 tracking-wide">画布</span>
        <div className="flex-1" />

        {/* Project selector */}
        {projects.length > 0 && (
          <select
            value={currentProject?.id ?? ""}
            onChange={(e) => {
              const p = projects.find((p) => p.id === e.target.value);
              setCurrentProject(p ?? null);
              if (p) loadScenes(p.id);
            }}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
          >
            <option value="">选择项目...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}

        {/* Create new project */}
        <div className="flex gap-1.5">
          <select
            value={newAspectRatio}
            onChange={(e) => setNewAspectRatio(e.target.value as "16:9" | "9:16")}
            className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-300 w-14"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
          <select
            value={newResolution}
            onChange={(e) => setNewResolution(e.target.value as "720p" | "1080p" | "4k")}
            className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-300 w-16"
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
            className="w-28 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-600"
          />
          <button
            onClick={handleCreate}
            disabled={busy || !newTitle.trim()}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 text-zinc-300 text-xs px-3 py-1 rounded transition-colors"
          >
            + 创建
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!currentProject ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-zinc-500 text-sm">创建或选择一个项目开始创作</p>
              <p className="text-zinc-700 text-xs mt-1">
                项目创建后，在左侧聊天框输入创意即可生成脚本
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl">
            {/* Project info */}
            <section>
              <h2 className="text-lg font-semibold text-zinc-200 mb-1">
                {currentProject.title}
                {scenes.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    · {scenes.length} 个镜头
                  </span>
                )}
              </h2>
              <div className="flex gap-3 text-xs text-zinc-500">
                <span>{currentProject.aspectRatio}</span>
                <span>{currentProject.resolution}</span>
                <span>
                  创建于 {new Date(currentProject.createdAt).toLocaleDateString()}
                </span>
              </div>
            </section>

            {/* Scenes */}
            <section>
              <SceneList />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
