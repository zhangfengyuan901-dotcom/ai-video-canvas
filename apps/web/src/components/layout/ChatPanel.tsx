// =========================================================================
// ChatPanel — 左侧聊天框
// =========================================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import type { ChatMessage } from "@ai-video-canvas/shared";

export default function ChatPanel() {
  const { messages, isGenerating, error, addMessage, setGenerating, setError } = useChatStore();
  const { currentProject, setScenes, setCurrentProject } = useProjectStore();
  const { post } = useApi();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto‑scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    if (!currentProject) {
      setError("请先创建或打开一个项目");
      return;
    }

    setInput("");
    setError(null);

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMsg);

    setGenerating(true);

    try {
      const data = await post<{
        title: string;
        aspectRatio: string;
        resolution: string;
        styleBible: Record<string, string>;
        scenes: Array<Record<string, unknown>>;
        sceneCount: number;
      }>(`/projects/${currentProject.id}/chat`, { message: text });

      // Add assistant message
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `已生成脚本「${data.title}」，共 ${data.sceneCount} 个镜头。`,
        createdAt: new Date().toISOString(),
        action: { type: "SCRIPT_GENERATE" },
      };
      addMessage(assistantMsg);

      // Update scenes in store
      setScenes(data.scenes as unknown as Parameters<typeof setScenes>[0]);

      // Update project title
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          title: data.title,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      setError(msg);

      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: `❌ ${msg}`,
        createdAt: new Date().toISOString(),
      };
      addMessage(errMsg);
    } finally {
      setGenerating(false);
    }
  }, [input, isGenerating, currentProject, addMessage, setError, setGenerating, setScenes, setCurrentProject, post]);

  return (
    <aside className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      {/* Header */}
      <div className="h-10 border-b border-zinc-800 flex items-center px-3">
        <span className="text-xs font-medium text-zinc-400 tracking-wide">聊天 · 脚本生成</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-600 text-center mt-8">
            输入创意，让 AI 帮你生成视频脚本
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-sm rounded-lg px-3 py-2 max-w-full ${
              m.role === "user"
                ? "bg-blue-600/20 text-blue-200 ml-4"
                : m.role === "system"
                  ? "bg-red-600/10 text-red-300"
                  : "bg-zinc-800 text-zinc-300 mr-4"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              {new Date(m.createdAt).toLocaleTimeString()}
            </span>
          </div>
        ))}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="text-xs text-zinc-500 animate-pulse px-1">
            AI 正在生成脚本...
          </div>
        )}

        {/* Error */}
        {error && !isGenerating && (
          <div className="text-xs text-red-400 bg-red-600/10 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="输入视频创意..."
            disabled={isGenerating}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-600 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isGenerating || !input.trim() || !currentProject}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm px-4 py-2 rounded font-medium transition-colors"
          >
            生成
          </button>
        </div>
        {!currentProject && (
          <p className="text-[10px] text-amber-500 mt-1.5">请先在 Canvas 中创建项目</p>
        )}
      </div>
    </aside>
  );
}
