import { cn } from "../../utils/cn";
import { Check } from "lucide-react";

export type StepStatus = "inactive" | "active" | "completed" | "error";

interface FlowStep {
  id: string;
  label: string;
  status: StepStatus;
}

interface FlowStepNavProps {
  steps: FlowStep[];
  className?: string;
}

const dotColors: Record<StepStatus, string> = {
  inactive: "bg-zinc-700",
  active: "bg-blue-500 shadow-sm shadow-blue-500/40",
  completed: "bg-emerald-500",
  error: "bg-rose-500",
};

const labelColors: Record<StepStatus, string> = {
  inactive: "text-zinc-600",
  active: "text-zinc-200",
  completed: "text-zinc-300",
  error: "text-rose-300",
};

export default function FlowStepNav({ steps, className }: FlowStepNavProps) {
  return (
    <nav className={cn("flex items-center gap-0", className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={step.id} className="flex items-center gap-0 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-300",
                  dotColors[step.status],
                )}
              >
                {step.status === "completed" && (
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                )}
                {step.status === "error" && (
                  <span className="text-[9px] font-bold text-white">!</span>
                )}
                {step.status === "active" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap transition-colors duration-300",
                  labelColors[step.status],
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "mx-2 h-px w-6 transition-colors duration-300",
                  step.status === "completed"
                    ? "bg-emerald-500/40"
                    : "bg-zinc-700/60",
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
