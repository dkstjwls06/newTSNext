import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "outline" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

/**
 * 공통 버튼 컴포넌트
 *
 * - variant 로 스타일만 바꿔 쓰게 하고
 * - 나머지 속성은 그대로 HTML button 에 전달
 */
export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium " +
    "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-offset-2 focus-visible:ring-black/50 " +
    "dark:focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50 " +
    "h-9 px-3 hover:cursor-pointer";

  const variantClass =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
      : variant === "outline"
      ? "border border-black/10 bg-transparent hover:bg-black/5 " +
        "dark:border-white/15 dark:hover:bg-white/10"
      : // ghost
        "bg-transparent hover:bg-black/5 dark:hover:bg-white/10";

  const merged = className
    ? `${base} ${variantClass} ${className}`
    : `${base} ${variantClass}`;

  return (
    <button className={merged} {...rest}>
      {children}
    </button>
  );
}