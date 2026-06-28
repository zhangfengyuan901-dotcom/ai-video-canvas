import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  variant?: "ghost" | "glass" | "primary" | "danger";
  size?: "sm" | "md";
}

export default function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "sm",
  className,
  ...props
}: IconButtonProps) {
  const sizes: Record<string, string> = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
  };

  const variants: Record<string, string> = {
    ghost: "text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600",
    glass: "text-gray-400 hover:text-gray-200 bg-gray-700/50 hover:bg-gray-600 border border-gray-600",
    primary: "text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700",
    danger: "text-rose-400 hover:text-rose-300 hover:bg-rose-600/15 active:bg-rose-600/10",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-40",
        sizes[size],
        variants[variant],
        className,
      )}
      title={label}
      aria-label={label}
      {...props}
    >
      {icon}
    </button>
  );
}
