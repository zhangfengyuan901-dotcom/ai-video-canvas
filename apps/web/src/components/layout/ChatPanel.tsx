// =========================================================================
// ChatPanel — 左侧聊天框 "Script Assistant" (redesigned to match UI mockup)
// =========================================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import FlowStepNav from "../ui/FlowStepNav";
import EmptyState from "../ui/EmptyState";
import GradientButton from "../ui/GradientButton";
import StatusBadge from "../ui/StatusBadge";
import { MessageSquarePlus, Send, Bot, User, Trash2, MessageCircle } from "lucide-react";
import type { ChatMessage } from "@ai-video-canvas/shared";
import type { StepStatus } from "../ui/FlowStepNav";

export default function ChatPanel() {
  const { messages, isGenerating, error, addMessage, setGenerating, setError, clearMessages } = useChatStore();
  const { currentProject, scenes, setScenes, setCurrentProject } = useProjectStore();
  const { post } = useApi();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Compute pipeline steps
  const pipelineSteps = [
    { id: "script", label: "Script", status: (scenes.length > 0 ? "completed" : "inactive") as StepStatus },
    { id: "storyboard", label: "Storyboard", status: (scenes.some((s) => s.storyboardReviewStatus === "approved") ? "completed" : scenes.length > 0 ? "active" : "inactive") as StepStatus },
    { id: "video", label: "Video", status: ("inactive") as StepStatus },
    { id: "export", label: "Export", status: ("inactive") as StepStatus },
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
      setError("Please create or open a project first");
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
        content: `Generated script "${data.title}" with ${data.sceneCount} shots.`,
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
      const msg = err instanceof Error ? err.message : "Unknown error";
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
    <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0 z-10">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 font-semibold text-sm text-gray-300 flex justify-between items-center">
        <span className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-gray-400" />
          Script Assistant
        </span>
        <button
          onClick={clearMessages}
          className="text-gray-500 hover:text-white transition"
          title="Clear Chat"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Pipeline steps */}
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/50">
        <FlowStepNav steps={pipelineSteps} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquarePlus className="h-8 w-8" />}
            title="Start Creating"
            message="Describe your video idea and I'll generate the storyboard and script for you."
            compact
            className="mt-8"
          />
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex gap-3">
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                  m.role === "user"
                    ? "bg-gray-600 border-gray-500"
                    : m.role === "system"
                      ? "bg-rose-600/20 border-rose-500/20"
                      : "bg-blue-900 border-blue-700"
                }`}
              >
                {m.role === "user" ? (
                  <User className="h-3.5 w-3.5 text-gray-300" />
                ) : m.role === "system" ? (
                  <span className="text-[10px] text-rose-400 font-bold">!</span>
                ) : (
                  <Bot className="h-3.5 w-3.5 text-blue-400" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm rounded-lg p-3 ${
                    m.role === "user"
                      ? "bg-blue-900/30 text-gray-200 border border-blue-800/30"
                      : m.role === "system"
                        ? "bg-rose-600/10 text-rose-300 border border-rose-500/10"
                        : "bg-gray-700 text-gray-200 shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</p>
                </div>
                <span className="text-[10px] text-gray-600 mt-1 block px-1">
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
            <span className="text-[11px] text-gray-500">AI is generating script...</span>
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
      <div className="p-3 border-t border-gray-700 bg-gray-800">
        <div className="relative">
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
            placeholder='E.g., A cyberpunk city chase scene at night...'
            disabled={isGenerating}
            rows={3}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none placeholder-gray-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isGenerating || !input.trim() || !currentProject}
            className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-md transition disabled:opacity-50 disabled:pointer-events-none"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {!currentProject && (
          <p className="text-[10px] text-amber-500/70 mt-1.5 px-1">
            Please create or select a project in the canvas first
          </p>
        )}
      </div>
    </aside>
  );
}
