// Écran 10 : reporting (PROMPT.md §9.5, planche 10-Reporting).
import type { Metadata } from "next";
import { BarChart, Legend, StackedColumns } from "@/components/ts/Charts";
import { requirePermission } from "@/lib/data/viewer";
import { dict, t } from "@/lib/i18n";
import { reportQuery, weekChoices, weekKey } from "@/lib/reporting/view";
import { loadReport } from "./load";
import { ExportMenu, ReportFilters } from "./ReportFilters";
import { TableScroll } from "@/components/ods/TableScroll";

export const metadata: Metadata = { title: dict.reporting.title };

const r = dict.reporting;

type Props = { searchParams: Promise<{ axe?: string; de?: string; a?: string; personne?: string }> };

export default async function Page({ searchParams }: Props) {
  const viewer = await requirePermission("VIEW_REPORTING");
  const { current, people, params, view, whole } = await loadReport(viewer, await searchParams);
  const { axis } = params;
  const sub = r.colSub[axis];
  const count = r.colCount[axis];

  return (
    <main className="container ts-stack">
      <div className="ts-head">
        <h1>{r.title}</h1>
        <ExportMenu query={reportQuery(params)} disabled={view.empty} />
      </div>

      <ReportFilters
        axis={axis}
        from={weekKey(params.from)}
        to={weekKey(params.to)}
        personId={params.personId ?? ""}
        weeks={weekChoices(current)}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        wholeLabel={t(whole ? r.wholeDivision : r.wholeTeam, { n: people.length })}
      />

      <ul aria-label={r.kpis} className="ts-kpis">
        <li className="card" style={{ gap: 5 }}>
          <span className="text-secondary">{r.entered}</span>
          <span className="h1">{view.table.foot.total}</span>
          <span className="small">{view.texts.capacity}</span>
        </li>
        <li className="card" style={{ gap: 5 }}>
          <span className="text-secondary">{r.fill}</span>
          <span className="h1">{view.texts.fill}</span>
          <span className="small">{view.texts.fillDetail}</span>
        </li>
        <li className="card" style={{ gap: 5 }}>
          <span className="text-secondary">{r.validated}</span>
          <span className="h1">{view.texts.validated}</span>
          <span className="small">{view.texts.validatedDetail}</span>
        </li>
      </ul>

      {view.empty ? (
        <div className="ts-empty" role="status">
          <h2 className="h4">{r.emptyTitle}</h2>
          <p>{r.emptyText}</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
            <figure className="card" style={{ flex: "3 1 480px", minWidth: 0 }}>
              <figcaption className="h4">{t(r.barsTitle[axis], { period: view.periodLower })}</figcaption>
              <BarChart bars={view.bars} />
            </figure>
            <figure className="card" style={{ flex: "2 1 320px", minWidth: 0 }}>
              <figcaption className="h4">{r.columnsTitle[axis]}</figcaption>
              <StackedColumns columns={view.columns} />
              <Legend label={r.legend[axis]} items={view.legend} />
              <p className="small text-secondary">{view.capacityNote}</p>
            </figure>
          </div>

          <section aria-labelledby="titre-detail" className="ts-section">
            <h2 className="h3" id="titre-detail">{r.detailTitle[axis]}</h2>
            <TableScroll>
              <table className="table">
                <caption className="visually-hidden">{t(r.detailCaption[axis], { period: view.periodLower })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{r.colEntity[axis]}</th>
                    {sub && <th scope="col">{sub}</th>}
                    {count && <th scope="col" className="num">{count}</th>}
                    {view.table.head.map((h) => (
                      <th scope="col" className="num" key={h}>{h}</th>
                    ))}
                    <th scope="col" className="num">{r.colTotal}</th>
                    <th scope="col" className="num">{r.colShare}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.table.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      {sub && <td>{row.sub}</td>}
                      {count && <td className="num">{row.count}</td>}
                      {row.cells.map((c, i) => (
                        <td className="num" key={i}>{c}</td>
                      ))}
                      <td className="num fw-bold">{row.total}</td>
                      <td className="num">{row.share}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={1 + (sub ? 1 : 0) + (count ? 1 : 0)}>{r.total}</th>
                    {view.table.foot.cells.map((c, i) => (
                      <td className="num" key={i}>{c}</td>
                    ))}
                    <td className="num">{view.table.foot.total}</td>
                    <td className="num">{view.table.foot.share}</td>
                  </tr>
                </tfoot>
              </table>
            </TableScroll>
          </section>
        </>
      )}
    </main>
  );
}
