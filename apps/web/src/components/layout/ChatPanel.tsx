// =========================================================================
// ChatPanel — 左侧聊天框 (redesigned)
// =========================================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import FlowStepNav from "../ui/FlowStepNav";
import EmptyState from "../ui/EmptyState";
import GradientButton from "../ui/GradientButton";
import StatusBadge from "../ui/StatusBadge";
import { MessageSquarePlus, Send, Bot, User } from "lucide-react";
import type { ChatMessage } from "@ai-video-canvas/shared";
import type { StepStatus } from "../ui/FlowStepNav";

export default function ChatPanel() {
  const { messages, isGenerating, error, addMessage, setGenerating, setError } = useChatStore();
  const { currentProject, scenes, setScenes, setCurrentProject } = useProjectStore();
  const { post } = useApi();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Compute pipeline steps
  const pipelineSteps = [
    { id: "script", label: "脚本", status: (scenes.length > 0 ? "completed" : "inactive") as StepStatus },
    { id: "storyboard", label: "故事板", status: (scenes.some((s) => s.storyboardReviewStatus === "approved") ? "completed" : scenes.length > 0 ? "active" : "inactive") as StepStatus },
    { id: "video", label: "视频", status: ("inactive") as StepStatus },
    { id: "export", label: "导出", status: ("inactive") as StepStatus },
  ];

  // Auto-scroll to bottom
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
    <aside className="w-[340px] bg-[#08090c] border-r border-white/[0.06] flex flex-col shrink-0">
      {/* Header with FlowStepNav */}
      <div className="h-11 border-b border-white/[0.06] flex items-center px-4 gap-2 shrink-0">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">流程</span>
        <div className="flex-1" />
        <FlowStepNav steps={pipelineSteps} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquarePlus className="h-8 w-8" />}
            title="开始创作"
            message="输入视频创意描述，AI 将自动生成分镜脚本。您可以输入完整的脚本、创意摘要或关键词。"
            compact
            className="mt-8"
          />
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex gap-2">
              {/* Avatar */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-blue-500 to-violet-600"
                    : m.role === "system"
                      ? "bg-rose-600/20"
                      : "bg-zinc-800"
                }`}
              >
                {m.role === "user" ? (
                  <User className="h-3.5 w-3.5 text-white" />
                ) : m.role === "system" ? (
                  <span className="text-[10px] text-rose-400 font-bold">!</span>
                ) : (
                  <Bot className="h-3.5 w-3.5 text-zinc-400" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm rounded-xl px-3 py-2 ${
                    m.role === "user"
                      ? "bg-blue-600/15 text-blue-200 border border-blue-500/10"
                      : m.role === "system"
                        ? "bg-rose-600/10 text-rose-300 border border-rose-500/10"
                        : "bg-white/[0.04] text-zinc-300 border border-white/[0.06]"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</p>
                </div>
                <span className="text-[10px] text-zinc-600 mt-1 block px-1">
                  {new Date(m.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-[11px] text-zinc-500">AI 正在生成脚本...</span>
          </div>
        )}

        {/* Error */}
        {error && !isGenerating && (
          <div className="text-[11px] text-rose-400 bg-rose-600/10 border border-rose-500/10 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="输入视频创意..."
            disabled={isGenerating}
            rows={1}
            className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 resize-none min-h-[36px] max-h-[80px]"
          />
          <button
            onClick={sendMessage}
            disabled={isGenerating || !input.trim() || !currentProject}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 transition-all hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700 disabled:opacity-40 disabled:pointer-events-none shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {!currentProject && (
          <p className="text-[10px] text-amber-500/70 mt-1.5 px-1">
            请先在画布中创建或选择项目
          </p>
        )}
      </div>
    </aside>
  );
}
