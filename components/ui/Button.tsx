import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "inverse" | "inverse-outline";
type Size = "sm" | "md";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-flag-blue text-surface hover:bg-flag-blue/90",
  secondary: "border-2 border-flag-blue bg-surface text-flag-blue hover:bg-page",
  ghost: "text-flag-blue hover:bg-page",
  // For use on a flag-blue background.
  inverse: "bg-surface text-flag-blue hover:bg-page",
  "inverse-outline": "border-2 border-surface text-surface hover:bg-surface/10",
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
