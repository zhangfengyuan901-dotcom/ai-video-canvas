import { type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export default function EmptyState({
  icon,
  title,
  message,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-6" : "gap-3 py-12",
        className,
      )}
    >
      {icon && (
        <div className="text-zinc-600/80">{icon}</div>
      )}
      {title && (
        <p className={cn("font-medium text-zinc-400", compact ? "text-xs" : "text-sm")}>
          {title}
        </p>
      )}
      {message && (
        <p className={cn("text-zinc-600 max-w-[260px]", compact ? "text-[10px]" : "text-xs")}>
          {message}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
