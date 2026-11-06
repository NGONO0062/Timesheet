import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/shared/lib/cx";

export type ButtonVariant = "default" | "primary" | "dark" | "success" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

// Bouton ODS (design/ods.css, « Button ») : survol par inversion de contraste,
// état actif orange (« active »), désactivé opaque (gris plein, jamais transparent).
const base =
  "inline-flex items-center justify-center gap-10 font-bold whitespace-nowrap cursor-pointer " +
  "disabled:cursor-not-allowed disabled:border-gray-999 disabled:bg-gray-999 disabled:text-white";

const variants: Record<ButtonVariant, string> = {
  default: "border-black bg-white text-black hover:bg-black hover:text-white active:border-active active:bg-active active:text-black",
  primary: "border-primary bg-primary text-black hover:border-black hover:bg-black hover:text-white active:border-active active:bg-active active:text-black",
  dark: "border-black bg-black text-white hover:bg-white hover:text-black active:border-active active:bg-active active:text-black",
  success: "border-success bg-success text-white hover:border-black hover:bg-black",
  danger: "border-danger bg-danger text-white hover:border-black hover:bg-black",
  link: "bg-transparent p-0 text-black underline underline-offset-2 hover:text-primary",
};

const sizes: Record<ButtonSize, string> = {
  sm: "border-2 min-h-control-sm rounded-sm px-10 py-5 text-sm",
  md: "border-2 min-h-control rounded-md px-btn-x py-btn-y text-btn",
  lg: "border-2 min-h-control-lg rounded-lg px-20 py-10 text-lead",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

/** Un seul bouton primaire par écran (CLAUDE.md). */
export function Button({ variant = "default", size = "md", type = "button", className, ...props }: ButtonProps) {
  return <button type={type} className={cx(base, variants[variant], variant === "link" ? "" : sizes[size], className)} {...props} />;
}
