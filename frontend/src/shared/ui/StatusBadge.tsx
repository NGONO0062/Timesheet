// Étiquettes de statut (planche C4). Composant unique : aucun autre libellé de statut.
import { cx } from "@/shared/lib/cx";
import { statusLook, type Glyph, type StatusKind, type StatusValue, type Tone } from "@/shared/lib/status";
import { Icon } from "./Icon";

export const BADGE = "inline-flex items-center gap-5 rounded-sm px-10 py-5 text-sm font-bold whitespace-nowrap align-middle";

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-gray-ddd text-black",
  success: "bg-success text-white",
  danger: "bg-danger text-white",
  warning: "bg-warning text-black",
  info: "bg-info text-white",
};

/** Symbole de l'étiquette : forme et libellé, jamais la couleur seule. */
export function StatusGlyph({ glyph }: { glyph: Glyph }) {
  switch (glyph) {
    case "none":
      return null;
    case "bang":
      return <span aria-hidden="true">!</span>;
    case "info":
      return <span aria-hidden="true">i</span>;
    case "todo":
      return <span className="size-10 flex-none rounded-round border-2 border-current" aria-hidden="true" />;
    case "play":
    case "pause":
      return <Icon name={glyph} size="tiny" />;
    default:
      return <Icon name={glyph} size="glyph" />;
  }
}

type Props<K extends StatusKind> = { kind: K; value: StatusValue[K]; params?: Record<string, string | number>; className?: string };

export function StatusBadge<K extends StatusKind>({ kind, value, params, className }: Props<K>) {
  const look = statusLook(kind, value, params);
  return (
    <span className={cx(BADGE, TONE_CLASSES[look.tone], className)}>
      <StatusGlyph glyph={look.glyph} />
      {look.label}
    </span>
  );
}
