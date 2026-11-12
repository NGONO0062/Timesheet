// Graphiques (PROMPT.md §4.3), repris de components/ts/Charts.tsx, sans bibliothèque : SVG et
// classes du thème (couleurs de séries chart-1 à chart-4, dans cet ordre, jamais ailleurs). Pas
// de style en ligne : les longueurs passent par les attributs du dessin. Chaque marque est une
// image nommée (lecteur d'écran) avec son infobulle ; les valeurs sont écrites en noir à côté.
import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

const FILL = ["fill-chart-1", "fill-chart-2", "fill-chart-3", "fill-chart-4"] as const;
const STROKE = ["stroke-chart-1", "stroke-chart-2", "stroke-chart-3", "stroke-chart-4"] as const;
const KEY = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"] as const;
const H = 160;

/** Barres horizontales : une barre par série, valeur écrite au bout. */
export function BarChart({ bars }: { bars: Array<{ key: string; label: string; series: number; valueText: string; width: number }> }) {
  return (
    <ul className="flex flex-col gap-20">
      {bars.map((b) => (
        <li key={b.key} className="grid grid-cols-chart-row items-center gap-10">
          <span>{b.label}</span>
          <svg className="block h-20 w-full" role="img" aria-label={`${b.label} : ${b.valueText}`}>
            <title>{`${b.label} : ${b.valueText}`}</title>
            <rect height="100%" width={`${Math.max(b.width, 1)}%`} rx="4" className={FILL[b.series] ?? FILL[3]} />
          </svg>
          <span className="text-right font-bold tabular-nums">{b.valueText}</span>
        </li>
      ))}
    </ul>
  );
}

type Column = { key: string; label: string; open: boolean; totalText: string; height: number };

/** Axe et libellés sous les colonnes ; `tight` : le même écart que des colonnes rapprochées. */
function Axis({ columns, tight }: { columns: Column[]; tight?: boolean }) {
  return (
    <div className={cx("flex pt-10 text-sm", tight ? "gap-10" : "gap-20")}>
      {columns.map((c) => (
        <span key={c.key} className="min-w-0 flex-1 text-center">
          {c.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Colonnes empilées par série, total écrit au-dessus, colonne évidée (contour seul) pour une
 * semaine encore ouverte. De bas en haut : la première série en bas de la pile.
 */
export function StackedColumns({ columns, label }: { columns: Array<Column & { segments: Array<{ key: string; series: number; value: number; title: string }> }>; label: string }) {
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-pad items-end gap-20 border-b-2 border-black">
        {columns.map((c) => {
          const total = c.segments.reduce((a, s) => a + s.value, 0) || 1;
          let y = H;
          return (
            <div key={c.key} className="flex flex-1 flex-col items-center gap-5 font-bold whitespace-nowrap">
              <span>{c.totalText}</span>
              <svg className="block w-cell" height={c.height} viewBox={`0 0 60 ${H}`} preserveAspectRatio="none" aria-hidden="true">
                {c.segments.map((s) => {
                  const h = (s.value * H) / total;
                  y -= h;
                  return (
                    <rect
                      key={s.key}
                      x="1"
                      y={y + 1}
                      width="58"
                      height={Math.max(h - 2, 0)}
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={c.open ? 2 : 0}
                      className={cx(c.open ? "fill-white" : FILL[s.series], STROKE[s.series])}
                    >
                      <title>{s.title}</title>
                    </rect>
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>
      <Axis columns={columns} />
    </div>
  );
}

/** Colonnes d'une seule série (la première couleur, le bleu), colonne évidée pour la semaine ouverte. */
export function Columns({ columns, label }: { columns: Array<Column & { title: string }>; label: string }) {
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-pad items-end gap-10 border-b-2 border-black">
        {columns.map((c) => (
          <div key={c.key} className="flex flex-1 flex-col items-center gap-5 font-bold whitespace-nowrap">
            <span>{c.totalText}</span>
            <svg className="block w-full" height={Math.max(c.height, 2)} viewBox={`0 0 60 ${H}`} preserveAspectRatio="none" aria-hidden="true">
              <rect x="1" y="1" width="58" height={H - 1} vectorEffect="non-scaling-stroke" strokeWidth={c.open ? 2 : 0} className={cx(c.open ? "fill-white" : FILL[0], STROKE[0])}>
                <title>{c.title}</title>
              </rect>
            </svg>
          </div>
        ))}
      </div>
      <Axis columns={columns} tight />
    </div>
  );
}

/** Légende, dès qu'il y a deux séries. */
export function Legend({ label, items }: { label: string; items: Array<{ key: string; label: string; series: number }> }): ReactNode {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-20 gap-y-5 text-sm" aria-label={label}>
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-5">
          <span className={cx("size-10 flex-none rounded-sm", KEY[i.series] ?? KEY[3])} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
