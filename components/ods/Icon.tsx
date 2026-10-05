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
  entry: (
    <>
      <rect x="3" y="4" width="14" height="13" />
      <path d="M3 9h14M7 2v4M13 2v4" />
    </>
  ),
  attendance: (
    <>
      <path d="M5 2h7l4 4v12H5z" />
      <path d="M8 10h5M8 14h5" />
    </>
  ),
  validation: (
    <>
      <rect x="3" y="3" width="14" height="14" />
      <path d="M6.5 10l2.5 2.5 4.5-5" />
    </>
  ),
  projects: <path d="M2 4h6l2 3h8v10H2z" />,
  reporting: <path d="M2 17h16M5 17v-6M10 17V4M15 17V8" />,
  division: (
    <>
      <rect x="7" y="2" width="6" height="5" />
      <rect x="2" y="13" width="6" height="5" />
      <rect x="12" y="13" width="6" height="5" />
      <path d="M10 7v3M5 13v-3h10v3" />
    </>
  ),
  admin: (
    <>
      <circle cx="7" cy="7" r="3" />
      <path d="M2 17c0-3 2-5 5-5s5 2 5 5" />
      <path d="M13 4a3 3 0 010 6M15 12c2 .8 3 2.5 3 5" />
    </>
  ),
  divisions: (
    <>
      <path d="M10 3l8 4-8 4-8-4z" />
      <path d="M2 12l8 4 8-4" />
    </>
  ),
  audit: (
    <>
      <path d="M8 5h9M8 10h9M8 15h9" />
      <path d="M3 5h1M3 10h1M3 15h1" />
    </>
  ),
  settings: (
    <>
      <circle cx="10" cy="10" r="5" />
      <circle cx="10" cy="10" r="1.5" />
      <path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.3 4.3l2.2 2.2M13.5 13.5l2.2 2.2M4.3 15.7l2.2-2.2M13.5 6.5l2.2-2.2" />
    </>
  ),
  logout: (
    <>
      <path d="M8 3H3v14h5" />
      <path d="M12 6l4 4-4 4M16 10H7" />
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
