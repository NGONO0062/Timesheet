// Composants ODS d'affichage : Badge, Tag, Alert, Toast, Card, List group,
// Table, Progress, Spinner, Placeholder.
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { dict } from "@/lib/i18n";
import { Icon, Mark } from "./Icon";
import { TableScroll } from "./TableScroll";

export type Tone = "success" | "danger" | "warning" | "info";

/**
 * Badge ODS. Les badges colorés portent un glyphe (§4.3, point 4).
 * Pour un statut métier, utilisez <StatusBadge> : c'est la seule source des libellés.
 */
export function Badge({ tone, dark, children, className }: { tone?: Tone; dark?: boolean; children: ReactNode; className?: string }) {
  return <span className={cx("badge", tone && `bg-${tone}`, dark && "bg-dark", className)}>{children}</span>;
}

/** Tag ODS, éventuellement retirable. */
export function Tag({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className="tag">
      {children}
      {onRemove && (
        <button className="btn-link btn" type="button" aria-label={removeLabel} onClick={onRemove}>
          <Icon name="cross" />
        </button>
      )}
    </span>
  );
}

type AlertProps = {
  tone: Tone;
  heading?: ReactNode;
  children?: ReactNode;
  /** Action placée à droite du texte (ex. « Annuler », « Réessayer »). */
  action?: ReactNode;
  /** `alert` pour une erreur à annoncer, `status` pour un résultat d'action. */
  role?: "alert" | "status";
  className?: string;
};

/** Alert ODS : pastille à glyphe, titre en gras, texte. */
export function Alert({ tone, heading, children, action, role, className }: AlertProps) {
  return (
    <div className={cx("alert", `alert-${tone}`, className)} role={role}>
      <Mark tone={tone} />
      <div
        className="alert-body"
        style={action ? { flexFlow: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px 20px" } : undefined}
      >
        {action ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {heading && <p className="alert-heading">{heading}</p>}
              {children}
            </div>
            {action}
          </>
        ) : (
          <>
            {heading && <p className="alert-heading">{heading}</p>}
            {children}
          </>
        )}
      </div>
    </div>
  );
}

/** Toast ODS : message bref, fermable. */
export function Toast({ tone, children, onClose }: { tone: Tone; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="toast" role="status">
      <Mark tone={tone} />
      <div className="toast-body">{children}</div>
      {onClose && (
        <button className="btn btn-icon btn-sm" type="button" aria-label={dict.form.close} onClick={onClose}>
          <Icon name="cross" />
        </button>
      )}
    </div>
  );
}

type CardProps = HTMLAttributes<HTMLElement> & { strong?: boolean; muted?: boolean; as?: "section" | "div" | "article" | "aside" };

/** Card ODS. `strong` : bordure noire ; `muted` : fond #fafafa. */
export function Card({ strong, muted, as: Tag = "section", className, children, ...rest }: CardProps) {
  return (
    <Tag className={cx("card", strong && "card-strong", muted && "card-muted", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function ListGroup({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <ul className={cx("list-group", className)} aria-label={label}>
      {children}
    </ul>
  );
}

export function ListGroupItem({ children, active, className, style }: { children: ReactNode; active?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <li className={cx("list-group-item", active && "active", className)} aria-current={active || undefined} style={style}>
      {children}
    </li>
  );
}

/**
 * Table ODS. La légende est obligatoire (masquée visuellement si besoin).
 * Les tableaux larges défilent dans `.table-responsive`.
 */
export function Table({ caption, hideCaption = true, responsive = true, children, className }: {
  caption: string;
  hideCaption?: boolean;
  responsive?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const table = (
    <table className={cx("table", className)}>
      <caption className={hideCaption ? "visually-hidden" : undefined}>{caption}</caption>
      {children}
    </table>
  );
  return responsive ? <TableScroll label={caption}>{table}</TableScroll> : table;
}

/** Progress ODS. La valeur est toujours écrite à côté par l'écran (2,2:1 sur la piste). */
export function Progress({ value, label, tone }: { value: number; label: string; tone?: "danger" | "success" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("progress-bar", tone && `bg-${tone}`)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Spinner ODS, annoncé par une zone de statut. */
export function Spinner({ label = dict.form.loading }: { label?: string }) {
  return (
    <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span className="spinner-border" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

/** Placeholder ODS (variante §4.3 : aplat plein, battement de couleur). */
export function Placeholder({ width, height, radius }: { width?: number | string; height?: number; radius?: 4 | 6 | 8 }) {
  return <span className="placeholder" aria-hidden="true" style={{ width, height, borderRadius: radius }} />;
}
