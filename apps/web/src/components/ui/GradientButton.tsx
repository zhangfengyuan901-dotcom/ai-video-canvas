import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "glass";
  size?: "sm" | "md" | "lg";
}

export default function GradientButton({
  children,
  variant = "primary",
  size = "sm",
  className,
  disabled,
  ...props
}: GradientButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-40 select-none";

  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm",
  };

  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700",
    secondary:
      "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:text-gray-200 active:bg-gray-700",
    ghost:
      "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 active:bg-gray-700",
    danger:
      "bg-rose-600/15 text-rose-400 border border-rose-600/20 hover:bg-rose-600/25 hover:text-rose-300 active:bg-rose-600/20",
    glass:
      "bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600/50 hover:text-gray-200 active:bg-gray-700 backdrop-blur-sm",
  };

  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
