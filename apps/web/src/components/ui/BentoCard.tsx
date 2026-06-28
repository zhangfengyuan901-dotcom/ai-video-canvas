import { type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface BentoCardProps {
  label: string;
  value: string;
  accent?: boolean;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function BentoCard({
  label,
  value,
  accent = false,
  children,
  className,
  onClick,
}: BentoCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-gray-700 bg-gray-800 p-3 transition-all duration-200",
        accent
          ? "border-emerald-500/20 bg-emerald-500/[0.05]"
          : "hover:border-gray-600 hover:bg-gray-700",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-semibold tracking-tight",
          accent ? "text-emerald-400" : "text-gray-100",
        )}
      >
        {value}
      </p>
      {children}
    </div>
  );
}
