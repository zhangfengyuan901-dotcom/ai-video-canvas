// =========================================================================
// CanvasPanel — 中间画布 / 项目操作区 (redesigned to match UI mockup)
// 三种模式：无项目 → 有项目无选中 → 有项目有选中（画布+编辑器）
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../hooks/useApi";
import { useProjectStore } from "../../stores/projectStore";
import GlassPanel from "../ui/GlassPanel";
import SectionHeader from "../ui/SectionHeader";
import EmptyState from "../ui/EmptyState";
import { FolderPlus, Film, Search } from "lucide-react";
import SceneList from "../scene/SceneList";
import ProjectProgressPanel from "../project/ProjectProgressPanel";
import ScriptInputPanel from "../script/ScriptInputPanel";
import ScriptPreviewPanel from "../script/ScriptPreviewPanel";
import CanvasViewport, { CanvasViewportEmpty } from "./CanvasViewport";
import ShotEditor from "../scene/ShotEditor";
import type { Project } from "@ai-video-canvas/shared";

export default function CanvasPanel() {
  const { post, get } = useApi();
  const {
    projects,
    currentProject,
    scenes,
    selectedSceneId,
    createProject,
    setCurrentProject,
    setProjects,
    setScenes,
  } = useProjectStore();
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
  const loadScenes = useCallback(
    async (projectId: string) => {
      try {
        const list = await get<any[]>(`/projects/${projectId}/scenes`);
        setScenes(list as any);
      } catch (err) {
        console.error("Failed to load scenes:", err);
      }
    },
    [get, setScenes],
  );

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
      const p = await post<Project>("/projects", {
        title,
        aspectRatio: newAspectRatio,
        resolution: newResolution,
      });
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

  // ---- Derive the selected scene object ----
  const selectedScene = selectedSceneId
    ? scenes.find((s) => s.id === selectedSceneId) ?? null
    : null;

  // ---- Mode decision ----
  const hasProject = !!currentProject;
  const hasSelection = hasProject && !!selectedScene;

  return (
    <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
      {/* Toolbar */}
      <div className="h-11 border-b border-gray-700 bg-gray-800 flex items-center px-4 gap-3 shrink-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Canvas</span>
        <div className="flex-1" />

        {/* Project selector */}
        {projects.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Search className="h-3 w-3 text-gray-500" />
            <select
              value={currentProject?.id ?? ""}
              onChange={(e) => {
                const p = projects.find((p) => p.id === e.target.value);
                setCurrentProject(p ?? null);
                if (p) loadScenes(p.id);
              }}
              className="bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
            >
              <option value="">Select project...</option>
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
            className="bg-gray-700 border border-gray-600 rounded-lg px-1.5 py-1 text-xs text-gray-400 focus:outline-none focus:border-blue-500 w-14 appearance-none cursor-pointer"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
          <select
            value={newResolution}
            onChange={(e) => setNewResolution(e.target.value as "720p" | "1080p" | "4k")}
            className="bg-gray-700 border border-gray-600 rounded-lg px-1.5 py-1 text-xs text-gray-400 focus:outline-none focus:border-blue-500 w-16 appearance-none cursor-pointer"
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
            placeholder="New project name"
            className="w-28 bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={busy || !newTitle.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 text-white px-3 py-1 text-xs font-medium transition-all hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700 disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-blue-500/20"
          >
            <FolderPlus className="h-3 w-3" />
            {busy ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* MODE 1: No project selected */}
        {!hasProject && (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<Film className="h-10 w-10" />}
              title="Start Your AI Video Creation"
              message="Create or select a project, then describe your video idea. AI will generate storyboard scripts, panel images, and final videos."
              action={
                <div className="mt-2 text-[11px] text-gray-500">
                  Select an existing project, or enter a name above and click "Create"
                </div>
              }
            />
          </div>
        )}

        {/* MODE 2: Project selected, NO scene selected — show overview */}
        {hasProject && !hasSelection && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto p-5 lg:p-6 space-y-5">
              {/* Project header */}
              <GlassPanel className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-100 tracking-tight">
                      {currentProject!.title}
                      {scenes.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          · {scenes.length} shots
                        </span>
                      )}
                    </h2>
                    <div className="flex gap-3 mt-1 text-[11px] text-gray-500">
                      <span>{currentProject!.aspectRatio}</span>
                      <span>{currentProject!.resolution}</span>
                      <span>
                        Created {new Date(currentProject!.createdAt).toLocaleDateString()}
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

              {/* Scenes overview */}
              <section>
                <SectionHeader
                  title="Shot List"
                  count={scenes.length}
                  subtitle="Click a shot to edit it in the canvas viewport"
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
                      title="No shots yet"
                      message="Describe your video idea on the left and click 'Create Script' to generate shots"
                    />
                  </GlassPanel>
                )}
              </section>
            </div>
          </div>
        )}

        {/* MODE 3: Project selected AND scene selected — show canvas + editor */}
        {hasSelection && selectedScene && (
          <>
            <CanvasViewport sceneId={selectedScene.id} />
            <ShotEditor scene={selectedScene} />
          </>
        )}
      </div>
    </main>
  );
}
