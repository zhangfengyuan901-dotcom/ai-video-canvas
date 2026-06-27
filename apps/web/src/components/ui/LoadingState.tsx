import { cn } from "../../utils/cn";

interface LoadingStateProps {
  className?: string;
  message?: string;
  variant?: "spinner" | "skeleton" | "pulse";
}

export default function LoadingState({
  className,
  message,
  variant = "spinner",
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="h-4 w-3/4 rounded-md bg-white/[0.04] animate-pulse" />
        <div className="h-8 w-full rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-8 w-full rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-8 w-1/2 rounded-lg bg-white/[0.04] animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-8", className)}>
      {variant === "spinner" && (
        <div className="relative h-6 w-6">
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
        </div>
      )}
      {variant === "pulse" && (
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-zinc-600 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-zinc-600 animate-bounce [animation-delay:300ms]" />
        </div>
      )}
      {message && (
        <p className="text-xs text-zinc-500 animate-pulse">{message}</p>
      )}
    </div>
  );
}
