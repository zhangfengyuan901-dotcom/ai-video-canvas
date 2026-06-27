import { type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function GlassPanel({ children, className, hover = false, onClick }: GlassPanelProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-sm backdrop-blur-sm",
        hover && "transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05] hover:shadow-md",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}
