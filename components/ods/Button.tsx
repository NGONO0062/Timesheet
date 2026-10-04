import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "default" | "primary" | "dark" | "success" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône placée avant le libellé. */
  icon?: IconName;
  /** Bouton carré sans texte visible : `aria-label` obligatoire. */
  iconOnly?: boolean;
  block?: boolean;
  active?: boolean;
  children?: ReactNode;
};

export function buttonClass({ variant = "default", size = "md", iconOnly, block, active }: Common, extra?: string) {
  return cx(
    "btn",
    variant !== "default" && `btn-${variant}`,
    size !== "md" && `btn-${size}`,
    iconOnly && "btn-icon",
    block && "btn-block",
    active && "active",
    extra,
  );
}

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>;

/** Button ODS. Un seul `variant="primary"` par écran. */
export function Button({ variant, size, icon, iconOnly, block, active, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ variant, size, iconOnly, block, active }, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

type LinkProps = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Lien de navigation présenté en bouton. */
export function ButtonLink({ variant, size, icon, iconOnly, block, active, className, children, href, ...rest }: LinkProps) {
  return (
    <Link href={href} className={buttonClass({ variant, size, iconOnly, block, active }, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}

/** Button group ODS. Le bouton actif porte une coche (la couleur ne suffit pas). */
export function ButtonGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("btn-group", className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}
