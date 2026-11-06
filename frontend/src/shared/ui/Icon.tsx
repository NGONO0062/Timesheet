// Icône unique de l'application (PROMPT.md §3). Tracés génériques en attendant
// les icônes Solaris d'Orange : on les remplacera ici, d'un coup.
import { cx } from "@/shared/lib/cx";

/** Glyphes pleins (polygones sur 100 × 100), repris des formes de la maquette. */
const GLYPHS = {
  left: "65,15 30,50 65,85 75,75 50,50 75,25",
  right: "35,15 70,50 35,85 25,75 50,50 25,25",
  down: "15,35 50,70 85,35 75,25 50,50 25,25",
  check: "10,55 22,43 40,61 78,20 90,32 40,85",
  cross: "20,10 50,40 80,10 90,20 60,50 90,80 80,90 50,60 20,90 10,80 40,50 10,20",
  plus: "42,10 58,10 58,42 90,42 90,58 58,58 58,90 42,90 42,58 10,58 10,42 42,42",
  minus: "10,42 90,42 90,58 10,58",
  menu: "10,20 90,20 90,32 10,32 10,44 90,44 90,56 10,56 10,68 90,68 90,80 10,80",
  play: "15,5 95,50 15,95",
  pause: "10,5 40,5 40,95 10,95 10,5 60,5 90,5 90,95 60,95 60,5",
} as const;

/** Icônes de navigation, tracées au contour (2 px sur 20 × 20). */
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
  tasks: (
    <>
      <rect x="2" y="3" width="4" height="14" />
      <rect x="8" y="3" width="4" height="9" />
      <rect x="14" y="3" width="4" height="6" />
    </>
  ),
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

export type GlyphName = keyof typeof GLYPHS;
export type NavIconName = keyof typeof NAV_PATHS;
export type IconName = GlyphName | NavIconName;

/** Tailles : 20 px par défaut, « glyph » 14 px (étiquettes), « tiny » 10 px. */
const SIZES = { md: "size-20", glyph: "size-glyph", tiny: "size-10" } as const;

export function Icon({ name, size = "md", className }: { name: IconName; size?: keyof typeof SIZES; className?: string }) {
  const classes = cx("inline-block flex-none", SIZES[size], className);
  if (name in GLYPHS) {
    return (
      <svg className={classes} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
        <polygon points={GLYPHS[name as GlyphName]} />
      </svg>
    );
  }
  return (
    <svg className={classes} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {NAV_PATHS[name as NavIconName]}
    </svg>
  );
}
