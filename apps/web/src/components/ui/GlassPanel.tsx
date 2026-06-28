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
        "rounded-xl border border-gray-700 bg-gray-800/80 shadow-sm",
        hover && "transition-all duration-200 hover:border-gray-600 hover:bg-gray-700/80 hover:shadow-md",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}
