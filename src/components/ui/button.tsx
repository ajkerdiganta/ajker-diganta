import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]",
        variant === "primary" && "bg-forest text-white shadow-sm hover:bg-forest-700",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-paper-50",
        variant === "ghost" && "text-ink-muted hover:bg-paper-100",
        className,
      )}
      {...props}
    />
  );
}
