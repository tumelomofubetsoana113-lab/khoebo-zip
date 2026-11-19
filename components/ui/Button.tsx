import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "inverse" | "inverse-outline";
type Size = "sm" | "md";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-surface hover:bg-brand/90",
  secondary: "border-2 border-brand bg-surface text-brand hover:bg-page",
  // Quiet white button with a grey border, beside a primary one.
  outline: "border border-line bg-surface text-ink shadow-sm hover:bg-page",
  ghost: "text-brand hover:bg-page",
  // For use on an orange or charcoal background.
  inverse: "bg-surface text-brand hover:bg-page",
  // For use on a dark (charcoal) background.
  "inverse-outline": "border border-surface/25 bg-surface/5 text-surface hover:bg-surface/15",
};

const sizes: Record<Size, string> = {
  sm: "px-4 text-sm",
  md: "px-6 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

type StyleProps = { variant?: Variant; size?: Size };

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: StyleProps & ComponentProps<typeof Link>) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
