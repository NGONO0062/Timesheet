// Icône unique de l'application (PROMPT.md §3). Les tracés sont génériques en
// attendant les icônes Solaris d'Orange : on les remplacera ici, d'un coup.
import { cx } from "@/lib/cx";

/** Glyphes simples, tracés en CSS (.ico-*) comme dans la maquette. */
const GLYPHS = ["left", "right", "down", "check", "cross", "plus", "minus", "menu"] as const;

/** Icônes de navigation, tracées en SVG (contour 2 px). */
const NAV_PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="5" height="5" />
      <rect x="12" y="3" width="5" height="5" />
      <rect x="3" y="12" width="5" height="5" />
      <rect x="12" y="12" width="5" height="5" />
    </>
  ),
} as const;

export type GlyphName = (typeof GLYPHS)[number];
export type NavIconName = keyof typeof NAV_PATHS;
export type IconName = GlyphName | NavIconName;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  if ((GLYPHS as readonly string[]).includes(name)) {
    return <span className={cx("ico", `ico-${name}`, className)} aria-hidden="true" />;
  }
  return (
    <svg
      className={cx("nav-ico", className)}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {NAV_PATHS[name as NavIconName]}
    </svg>
  );
}

/** Pastille de statut : forme et glyphe, jamais la couleur seule. */
export function Mark({ tone }: { tone: "success" | "danger" | "warning" | "info" }) {
  return <span className={`mark mark-${tone}`} aria-hidden="true" />;
}
