// Composants ODS d'affichage : Badge, Tag, Mark, Alert, Toast, Card, List group,
// Table, Progress, Spinner, Placeholder (design/ods.css, reproduits avec Tailwind).
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import { dict } from "@/shared/i18n";
import type { Tone as StatusTone } from "@/shared/lib/status";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { BADGE, StatusGlyph, TONE_CLASSES } from "./StatusBadge";

export type Tone = Exclude<StatusTone, "neutral">;

const GLYPH: Record<Tone, "check" | "cross" | "bang" | "info"> = { success: "check", danger: "cross", warning: "bang", info: "info" };

/**
 * Badge ODS. Les badges colorés portent un glyphe : la couleur ne porte pas l'information seule.
 * Pour un statut métier, utilisez <StatusBadge> : c'est la seule source des libellés.
 */
export function Badge({ tone, dark, children, className }: { tone?: Tone; dark?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cx(BADGE, dark ? "bg-black text-white" : TONE_CLASSES[tone ?? "neutral"], className)}>
      {tone && <StatusGlyph glyph={GLYPH[tone]} />}
      {children}
    </span>
  );
}

/** Tag ODS, éventuellement retirable. */
export function Tag({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className="inline-flex min-h-control-sm items-center gap-5 rounded-sm border-2 border-black bg-white px-10 text-sm font-bold whitespace-nowrap">
      {children}
      {onRemove && (
        <button className="inline-flex cursor-pointer hover:text-primary" type="button" aria-label={removeLabel} onClick={onRemove}>
          <Icon name="cross" size="tiny" />
        </button>
      )}
    </span>
  );
}

const MARK_TONES: Record<Tone, string> = {
  success: "bg-success text-white",
  danger: "bg-danger text-white",
  warning: "bg-warning text-black",
  info: "bg-info text-white",
};

/** Pastille de statut d'un message : forme et glyphe, jamais la couleur seule. */
export function Mark({ tone }: { tone: Tone }) {
  return (
    <span className={cx("inline-flex size-mark flex-none items-center justify-center rounded-sm text-sm font-bold", MARK_TONES[tone])} aria-hidden="true">
      <StatusGlyph glyph={GLYPH[tone]} />
    </span>
  );
}

const ALERT_BORDERS: Record<Tone, string> = { success: "border-success", danger: "border-danger", warning: "border-warning", info: "border-info" };

type AlertProps = {
  tone: Tone;
  heading?: ReactNode;
  children?: ReactNode;
  /** Action placée à droite du texte (ex. « Annuler », « Réessayer »). */
  action?: ReactNode;
  /** `alert` pour une erreur à annoncer, `status` pour un résultat d'action. */
  role?: "alert" | "status";
  className?: string;
  /** Message fermable : croix à droite, comme le Toast ODS. */
  onClose?: () => void;
};

/** Alert ODS : pastille à glyphe, titre en gras, texte. */
export function Alert({ tone, heading, children, action, role, className, onClose }: AlertProps) {
  return (
    <div className={cx("flex items-start gap-10 rounded-md border-2 bg-white p-20", ALERT_BORDERS[tone], className)} role={role}>
      <Mark tone={tone} />
      <div className={cx("flex min-w-0 flex-1 gap-10", action ? "flex-wrap items-center justify-between gap-x-20" : "flex-col")}>
        <div className="flex flex-col gap-10">
          {heading && <p className="font-bold">{heading}</p>}
          {children}
        </div>
        {action}
      </div>
      {onClose && (
        <Button size="sm" className="w-control-sm px-0" aria-label={dict.form.closeMessage} onClick={onClose}>
          <Icon name="cross" />
        </Button>
      )}
    </div>
  );
}

/** Toast ODS : message bref, fermable. */
export function Toast({ tone, children, onClose }: { tone: Tone; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center gap-10 rounded-md border-2 border-black bg-white px-20 py-10" role="status">
      <Mark tone={tone} />
      <div className="flex-1">{children}</div>
      {onClose && (
        <Button size="sm" className="w-control-sm px-0" aria-label={dict.form.close} onClick={onClose}>
          <Icon name="cross" />
        </Button>
      )}
    </div>
  );
}

type CardProps = HTMLAttributes<HTMLElement> & { strong?: boolean; muted?: boolean; as?: "section" | "div" | "article" | "aside" };

/** Card ODS. `strong` : bordure noire ; `muted` : fond gray-fa. */
export function Card({ strong, muted, as: Element = "section", className, children, ...rest }: CardProps) {
  return (
    <Element
      className={cx("flex flex-col gap-20 rounded-md border-2 p-20", strong ? "border-black" : "border-gray-999", muted ? "bg-gray-fa" : "bg-white", className)}
      {...rest}
    >
      {children}
    </Element>
  );
}

export function ListGroup({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <ul className={cx("rounded-md border-2 border-gray-999", className)} aria-label={label}>
      {children}
    </ul>
  );
}

export function ListGroupItem({ children, active, className }: { children: ReactNode; active?: boolean; className?: string }) {
  return (
    <li
      className={cx(
        "flex flex-wrap items-center justify-between gap-x-20 gap-y-10 border-b-2 border-gray-999 px-20 py-10 last:border-b-0",
        active && "accent-mark font-bold",
        className,
      )}
      aria-current={active || undefined}
    >
      {children}
    </li>
  );
}

/**
 * Conteneur des tableaux larges. Quand il défile, il devient atteignable au clavier,
 * avec pour nom la légende du tableau (WCAG 2.1.1, règle axe scrollable-region-focusable).
 */
export function TableScroll({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [name, setName] = useState(label);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!label) setName(el.querySelector("caption")?.textContent?.trim() || undefined);
    const check = () => setScrollable(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    const inner = el.firstElementChild;
    if (inner) observer.observe(inner);
    return () => observer.disconnect();
  }, [label]);

  return (
    <div
      ref={ref}
      className={cx("overflow-x-auto", className)}
      tabIndex={scrollable ? 0 : undefined}
      role={scrollable ? "region" : undefined}
      aria-label={scrollable ? name : undefined}
    >
      {children}
    </div>
  );
}

/** Cellules de tableau ODS : à appliquer aux th et td (les styles de ligne sont dans TABLE). */
export const TABLE =
  "w-full border-collapse " +
  "[&_th]:border-b-2 [&_th]:border-gray-999 [&_th]:p-10 [&_th]:text-left [&_th]:align-middle " +
  "[&_td]:border-b-2 [&_td]:border-gray-999 [&_td]:p-10 [&_td]:text-left [&_td]:align-middle " +
  "[&_thead_th]:border-black [&_thead_th]:font-bold [&_thead_th]:whitespace-nowrap " +
  "[&_tbody_th]:font-bold [&_tbody_tr:hover]:bg-gray-ddd " +
  "[&_tfoot_td]:border-t-2 [&_tfoot_td]:border-b-0 [&_tfoot_td]:border-black [&_tfoot_td]:font-bold " +
  "[&_tfoot_th]:border-t-2 [&_tfoot_th]:border-b-0 [&_tfoot_th]:border-black";

/** Table ODS. La légende est obligatoire (masquée visuellement si besoin). */
export function Table({ caption, hideCaption = true, responsive = true, children, className }: {
  caption: string;
  hideCaption?: boolean;
  responsive?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const table = (
    <table className={cx(TABLE, className)}>
      <caption className={hideCaption ? "sr-only" : "pb-10 text-left font-bold"}>{caption}</caption>
      {children}
    </table>
  );
  return responsive ? <TableScroll label={caption}>{table}</TableScroll> : table;
}

/** Progress ODS. La valeur est toujours écrite à côté par l'écran. Barre en SVG : largeur variable sans style en ligne. */
export function Progress({ value, label, tone }: { value: number; label: string; tone?: "danger" | "success" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <svg className="block h-10 w-full bg-gray-ddd" aria-hidden="true">
        <rect height="100%" width={`${pct}%`} className={tone === "danger" ? "fill-danger" : tone === "success" ? "fill-success" : "fill-primary"} />
      </svg>
    </div>
  );
}

/** Spinner ODS, annoncé par une zone de statut. */
export function Spinner({ label = dict.form.loading }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-10">
      <svg className="size-20 animate-spin" viewBox="0 0 20 20" fill="none" strokeWidth="2" aria-hidden="true">
        <circle cx="10" cy="10" r="8" className="stroke-gray-ddd" />
        <path d="M10 2a8 8 0 0 1 8 8" className="stroke-black" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Placeholder ODS (squelette) : aplat plein qui bat entre gray-ddd et gray-fa, sans opacité ni dégradé. */
export function Placeholder({ className }: { className?: string }) {
  return <span className={cx("block h-text animate-placeholder rounded-sm bg-gray-ddd motion-reduce:animate-none", className)} aria-hidden="true" />;
}
