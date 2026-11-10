// Écran 10 : reporting (PROMPT.md §9.5, planche 10-Reporting). Filtres gardés dans l'adresse
// (axe, semaines de début et de fin, périmètre) ; les exports reprennent les mêmes.
import { useSearchParams } from "react-router";
import { AXES, buildReportView, exportHref, useReport, weekChoices, weekKey, type Axis, type Report, type ReportFilters } from "@/entities/report";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Placeholder, Table } from "@/shared/ui/Display";
import { Pills } from "@/shared/ui/Disclosure";
import { Dropdown } from "@/shared/ui/Dropdown";
import { SelectField } from "@/shared/ui/Form";
import { Icon } from "@/shared/ui/Icon";
import { EmptyState } from "@/shared/ui/States";
import { BarChart, Legend, StackedColumns } from "@/widgets/charts";

const r = dict.reporting;
const CARD = "flex flex-col gap-5 rounded-md border-2 border-gray-999 p-20";

export function ReportingPage() {
  const [params, setParams] = useSearchParams();
  const axis: Axis = (AXES as string[]).includes(params.get("axe") ?? "") ? (params.get("axe") as Axis) : "project";
  const filters: ReportFilters = { axis, from: params.get("de"), to: params.get("a"), personId: params.get("personne") };
  const query = useReport(filters);

  function go(k: string, v: string | null) {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  }

  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <h1>{r.title}</h1>
        <p className="sr-only" role="status">
          {r.loading}
        </p>
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="flex flex-col gap-30">
        <h1>{r.title}</h1>
        <Alert tone="danger" role="alert" heading={r.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
          <p>{r.errorText}</p>
        </Alert>
      </main>
    );
  }
  return <ReportView report={query.data} go={go} />;
}

function ReportView({ report, go }: { report: Report; go: (k: string, v: string | null) => void }) {
  const view = buildReportView(report);
  const axis = report.axis;
  const sub = r.colSub[axis];
  const count = r.colCount[axis];
  const weeks = weekChoices(report.current);
  // Les filtres effectifs (l'API remet les semaines dans l'ordre, ignore une personne hors périmètre).
  const effective: ReportFilters = { axis, from: weekKey(report.from), to: weekKey(report.to), personId: report.personId };

  return (
    <main className="flex flex-col gap-30">
      <div className="flex flex-wrap items-start justify-between gap-20">
        <h1>{r.title}</h1>
        {view.empty ? (
          <Button disabled title={r.exportDisabled}>
            {r.export}
          </Button>
        ) : (
          <Dropdown
            label={r.exportMenu}
            buttonClassName={({ open }) => cx(buttonClass(), open && "bg-black text-white")}
            menuClassName="right-0"
            items={(["csv", "xlsx", "pdf"] as const).map((f) => ({ key: f, content: f === "csv" ? r.exportCsv : f === "xlsx" ? r.exportExcel : r.exportPdf, href: exportHref(effective, f) }))}
          >
            {r.export}
            <Icon name="down" size="glyph" />
          </Dropdown>
        )}
      </div>

      <form aria-label={r.filters} className="flex flex-wrap items-end gap-x-20 gap-y-20" onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-5">
          <span className="font-bold" id="l-axe">
            {r.axis}
          </span>
          <Pills label={r.axis} value={axis} onChange={(a) => go("axe", a === "project" ? null : a)} options={AXES.map((a) => ({ value: a, label: r.axes[a] }))} />
        </div>
        <div className="w-full md:w-week-filter">
          <SelectField label={r.from} value={weekKey(report.from)} onChange={(e) => go("de", e.target.value)}>
            {weeks.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-full md:w-week-filter">
          <SelectField label={r.to} value={weekKey(report.to)} onChange={(e) => go("a", e.target.value)}>
            {weeks.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-full md:w-filter">
          <SelectField label={r.scope} value={report.personId ?? ""} onChange={(e) => go("personne", e.target.value || null)}>
            <option value="">{t(report.whole ? r.wholeDivision : r.wholeTeam, { n: report.people.length })}</option>
            {report.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        </div>
      </form>

      <ul aria-label={r.kpis} className="grid gap-20 md:grid-cols-3">
        <li className={CARD}>
          <span className="text-gray-595">{r.entered}</span>
          <span className="text-h1 font-bold">{view.texts.entered}</span>
          <span className="text-sm">{view.texts.capacity}</span>
        </li>
        <li className={CARD}>
          <span className="text-gray-595">{r.fill}</span>
          <span className="text-h1 font-bold">{view.texts.fill}</span>
          <span className="text-sm">{view.texts.fillDetail}</span>
        </li>
        <li className={CARD}>
          <span className="text-gray-595">{r.validated}</span>
          <span className="text-h1 font-bold">{view.texts.validated}</span>
          <span className="text-sm">{view.texts.validatedDetail}</span>
        </li>
      </ul>

      {view.empty ? (
        <EmptyState headingLevel={2} title={r.emptyTitle}>
          {r.emptyText}
        </EmptyState>
      ) : (
        <>
          <div className="grid items-start gap-20 lg:grid-cols-report">
            <figure className={cx(CARD, "gap-20")} aria-labelledby="titre-barres">
              <figcaption id="titre-barres" className="text-h4 font-bold">
                {t(r.barsTitle[axis], { period: view.periodLower })}
              </figcaption>
              <BarChart bars={view.bars} />
            </figure>
            <figure className={cx(CARD, "gap-20")} aria-labelledby="titre-colonnes">
              <figcaption id="titre-colonnes" className="text-h4 font-bold">
                {r.columnsTitle[axis]}
              </figcaption>
              <StackedColumns columns={view.columns} label={view.columnsAria} />
              <Legend label={r.legend[axis]} items={view.legend} />
              <p className="text-sm text-gray-595">{view.capacityNote}</p>
            </figure>
          </div>

          <section aria-labelledby="titre-detail" className="flex flex-col gap-20">
            <h2 id="titre-detail" className="text-h3">
              {r.detailTitle[axis]}
            </h2>
            <Table caption={t(r.detailCaption[axis], { period: view.periodLower })}>
              <thead>
                <tr>
                  <th scope="col">{r.colEntity[axis]}</th>
                  {sub && <th scope="col">{sub}</th>}
                  {count && (
                    <th scope="col" className="text-right">
                      {count}
                    </th>
                  )}
                  {view.table.head.map((h) => (
                    <th scope="col" className="text-right" key={h}>
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="text-right">
                    {r.colTotal}
                  </th>
                  <th scope="col" className="text-right">
                    {r.colShare}
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.table.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    {sub && <td>{row.sub}</td>}
                    {count && <td className="text-right tabular-nums">{row.count}</td>}
                    {row.cells.map((c, i) => (
                      <td className="text-right whitespace-nowrap tabular-nums" key={i}>
                        {c}
                      </td>
                    ))}
                    <td className="text-right font-bold whitespace-nowrap tabular-nums">{row.total}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">{row.share}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={1 + (sub ? 1 : 0) + (count ? 1 : 0)}>
                    {r.total}
                  </th>
                  {view.table.foot.cells.map((c, i) => (
                    <td className="text-right whitespace-nowrap tabular-nums" key={i}>
                      {c}
                    </td>
                  ))}
                  <td className="text-right whitespace-nowrap tabular-nums">{view.table.foot.total}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">{view.table.foot.share}</td>
                </tr>
              </tfoot>
            </Table>
          </section>
        </>
      )}
    </main>
  );
}
