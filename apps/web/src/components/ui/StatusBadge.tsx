import { cn } from "../../utils/cn";

export type BadgeStatus =
  | "default"
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "approved"
  | "rejected"
  | "waiting"
  | "draft"
  | "idle";

interface StatusBadgeProps {
  status: BadgeStatus | string;
  label?: string;
  className?: string;
  pulse?: boolean;
}

const statusStyleMap: Record<string, string> = {
  default: "bg-zinc-800 text-zinc-400 border-zinc-700/50",
  idle: "bg-zinc-800/60 text-zinc-500 border-zinc-700/30",
  draft: "bg-zinc-800 text-zinc-400 border-zinc-700/50",
  pending: "bg-amber-600/15 text-amber-400 border-amber-600/20",
  waiting: "bg-amber-600/15 text-amber-400 border-amber-600/20",
  running: "bg-blue-600/15 text-blue-400 border-blue-600/20",
  generating: "bg-blue-600/15 text-blue-400 border-blue-600/20",
  success: "bg-emerald-600/15 text-emerald-400 border-emerald-600/20",
  ready: "bg-emerald-600/15 text-emerald-400 border-emerald-600/20",
  approved: "bg-emerald-600/15 text-emerald-400 border-emerald-600/20",
  failed: "bg-rose-600/15 text-rose-400 border-rose-600/20",
  rejected: "bg-rose-600/15 text-rose-400 border-rose-600/20",
  storyboard_ready: "bg-emerald-600/15 text-emerald-400 border-emerald-600/20",
  video_ready: "bg-blue-600/15 text-blue-400 border-blue-600/20",
};

const labelMap: Record<string, string> = {
  idle: "未开始",
  draft: "草稿",
  pending: "待处理",
  waiting: "待审核",
  running: "进行中",
  generating: "生成中",
  success: "完成",
  ready: "就绪",
  approved: "已通过",
  failed: "失败",
  rejected: "已驳回",
  storyboard_ready: "三图就绪",
  video_ready: "视频就绪",
  queued: "排队中",
};

export default function StatusBadge({
  status,
  label,
  className,
  pulse = false,
}: StatusBadgeProps) {
  const style = statusStyleMap[status] ?? statusStyleMap.default;
  const displayLabel = label ?? labelMap[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        style,
        pulse && "animate-pulse",
        className,
      )}
    >
      {pulse && (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {displayLabel}
    </span>
  );
}
