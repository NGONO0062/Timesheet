// Graphiques (PROMPT.md §4.3, point 6) : barres et colonnes en HTML et CSS, classes
// .chart-* de design/ods.css, aucune bibliothèque. Chaque marque est focalisable et
// porte son infobulle, au survol comme au focus. Les valeurs sont écrites en noir.
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { SeriesClass } from "@/lib/reporting/report";

function Mark({ cls, label, style, className }: { cls?: SeriesClass; label: string; style?: CSSProperties; className?: string }) {
  return (
    <span className={cx("chart-mark", className, cls)} style={style} tabIndex={0} role="img" aria-label={label}>
      <span className="chart-tip" aria-hidden="true">{label}</span>
    </span>
  );
}

/** Barres horizontales : une barre par série, valeur écrite au bout. */
export function BarChart({ bars }: { bars: Array<{ key: string; label: string; cls: SeriesClass; valueText: string; width: number }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {bars.map((b) => (
        <div className="chart-row" key={b.key}>
          <span>{b.label}</span>
          <Mark className="chart-bar" cls={b.cls} label={`${b.label} : ${b.valueText}`} style={{ width: `${Math.max(b.width, 1)}%` }} />
          <span className="fw-bold num">{b.valueText}</span>
        </div>
      ))}
    </div>
  );
}

/** Colonnes empilées par série, total écrit au-dessus, colonne évidée pour une période ouverte. */
export function StackedColumns({ columns }: {
  columns: Array<{ key: string; label: string; open: boolean; totalText: string; height: number; segments: Array<{ key: string; cls: SeriesClass; value: number; title: string }> }>;
}) {
  return (
    <div>
      <div className="chart-cols">
        {columns.map((c) => (
          <div className={cx("chart-col", c.open && "is-open")} key={c.key}>
            <span>{c.totalText}</span>
            <span className="chart-stack" style={{ height: c.height }}>
              {c.segments.map((s) => (
                <Mark key={s.key} className="chart-seg" cls={s.cls} label={s.title} style={{ flexGrow: s.value }} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="chart-axis">
        {columns.map((c) => (
          <span key={c.key}>{c.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Colonnes d'une seule série (la première couleur, le bleu). */
export function Columns({ columns }: { columns: Array<{ key: string; label: string; open: boolean; valueText: string; height: number; title: string }> }) {
  return (
    <div>
      <div className="chart-cols chart-s1" style={{ gap: 10 }}>
        {columns.map((c) => (
          <div className={cx("chart-col", c.open && "is-open")} key={c.key}>
            <span>{c.valueText}</span>
            <Mark label={c.title} style={{ height: c.height }} />
          </div>
        ))}
      </div>
      <div className="chart-axis" style={{ gap: 10 }}>
        {columns.map((c) => (
          <span key={c.key}>{c.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Légende, dès qu'il y a deux séries. */
export function Legend({ label, items }: { label: string; items: Array<{ key: string; label: string; cls: SeriesClass }> }): ReactNode {
  if (items.length < 2) return null;
  return (
    <ul className="chart-legend" aria-label={label}>
      {items.map((i) => (
        <li key={i.key}>
          <span className={cx("chart-key", i.cls)} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
