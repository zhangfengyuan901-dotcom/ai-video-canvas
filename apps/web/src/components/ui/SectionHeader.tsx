import { type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  count?: number;
}

export default function SectionHeader({
  title,
  subtitle,
  action,
  className,
  count,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-gray-100 tracking-wide">
          {title}
          {count !== undefined && (
            <span className="ml-1.5 text-sm font-normal text-gray-500">
              · {count}
            </span>
          )}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
