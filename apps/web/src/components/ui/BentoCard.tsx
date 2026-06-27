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
        "rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200",
        accent
          ? "border-emerald-500/20 bg-emerald-500/[0.03]"
          : "hover:border-white/[0.10] hover:bg-white/[0.03]",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-semibold tracking-tight",
          accent ? "text-emerald-400" : "text-zinc-100",
        )}
      >
        {value}
      </p>
      {children}
    </div>
  );
}
