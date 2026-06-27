import { cn } from "../../utils/cn";

interface SoftDividerProps {
  className?: string;
  label?: string;
}

export default function SoftDivider({ className, label }: SoftDividerProps) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>
    );
  }

  return (
    <div className={cn("h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent", className)} />
  );
}
