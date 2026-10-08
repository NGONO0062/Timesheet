"use client";
// Filtres du rapport (planche 10) : axe d'analyse, période de semaine à semaine,
// périmètre. Ils sont gardés dans l'adresse ; les exports reprennent la même.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dropdown } from "@/components/ods/Dropdown";
import { Icon } from "@/components/ods/Icon";
import { cx } from "@/lib/cx";
import { dict } from "@/lib/i18n";
import { AXES, type Axis } from "@/lib/reporting/report";

const r = dict.reporting;

export function ReportFilters(props: {
  axis: Axis;
  from: string;
  to: string;
  personId: string;
  weeks: Array<{ key: string; label: string }>;
  people: Array<{ id: string; name: string }>;
  wholeLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const go = (k: string, v: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  return (
    <form aria-label={r.filters} className="ts-filters" onSubmit={(e) => e.preventDefault()}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span className="form-label" id="l-axe" style={{ marginBottom: 0 }}>{r.axis}</span>
        <ul className="nav nav-pills" aria-labelledby="l-axe">
          {AXES.map((a) => (
            <li key={a}>
              <button className={cx("nav-link", props.axis === a && "active")} type="button" aria-pressed={props.axis === a} onClick={() => go("axe", a === "project" ? null : a)}>
                {r.axes[a]}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="ts-filter ts-filter-sm">
        <label className="form-label" htmlFor="r-de">{r.from}</label>
        <select className="form-select" id="r-de" value={props.from} onChange={(e) => go("de", e.target.value)}>
          {props.weeks.map((w) => (
            <option key={w.key} value={w.key}>{w.label}</option>
          ))}
        </select>
      </div>
      <div className="ts-filter ts-filter-sm">
        <label className="form-label" htmlFor="r-a">{r.to}</label>
        <select className="form-select" id="r-a" value={props.to} onChange={(e) => go("a", e.target.value)}>
          {props.weeks.map((w) => (
            <option key={w.key} value={w.key}>{w.label}</option>
          ))}
        </select>
      </div>
      <div className="ts-filter ts-filter-sm">
        <label className="form-label" htmlFor="r-qui">{r.scope}</label>
        <select className="form-select" id="r-qui" value={props.personId} onChange={(e) => go("personne", e.target.value || null)}>
          <option value="">{props.wholeLabel}</option>
          {props.people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </form>
  );
}

/** Menu Exporter (Dropdown : CSV, Excel, PDF). Désactivé, sa raison est écrite à côté. */
export function ExportMenu({ query, disabled }: { query: string; disabled: boolean }) {
  if (disabled) {
    return (
      <span className="ts-head-start" style={{ gap: 10 }}>
        <span className="small" id="raison-export">{r.exportDisabled}</span>
        <button className="btn" type="button" disabled aria-describedby="raison-export">
          {r.export}
          <Icon name="down" />
        </button>
      </span>
    );
  }
  return (
    <Dropdown
      label={r.exportMenu}
      items={(["csv", "xlsx", "pdf"] as const).map((f) => ({
        key: f,
        content: <span>{f === "csv" ? r.exportCsv : f === "xlsx" ? r.exportExcel : r.exportPdf}</span>,
        href: `/reporting/export?${query}${query ? "&" : ""}format=${f}`,
      }))}
      trigger={(p) => (
        <button className="btn" type="button" {...p}>
          {r.export}
          <Icon name="down" />
        </button>
      )}
    />
  );
}
