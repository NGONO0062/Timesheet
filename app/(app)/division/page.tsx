// Écran 11 : vue consolidée de la division (PROMPT.md §9.6, planche 11-Vue-consolidee).
// L'erreur se gère bloc par bloc (§12) : un bloc en panne n'empêche pas les autres.
import type { Metadata } from "next";
import { Progress } from "@/components/ods/Display";
import { Columns } from "@/components/ts/Charts";
import { EmptyState } from "@/components/ts/States";
import { now } from "@/lib/clock";
import { getDivisionFrame, getDriftSources, getWeekStates } from "@/lib/data/division";
import { currentWeek, weekFrame } from "@/lib/data/timesheets";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import {
  budgetDrifts, driftRow, fillText, kpiTexts, lateDrifts, missingDrifts, pct, sortDrifts, teamAnchor, teamTable, trend, underfillDrifts, TREND_WEEKS, type Drift,
} from "@/lib/division/consolidated";
import { dict, t } from "@/lib/i18n";
import { compareWeeks, shiftWeek } from "@/lib/iso-week";
import { parseWeek } from "@/lib/routes";
import { sum } from "@/lib/timesheet/rules";
import { BlockError, DivisionWeekNav, RemindButton } from "./DivisionClient";
import { TableScroll } from "@/components/ods/TableScroll";

export const metadata: Metadata = { title: dict.division.screenTitle };

const d = dict.division;
const plural = (n: number, one: string, many: string) => t(n > 1 ? many : one, { n });

type Props = { searchParams: Promise<{ annee?: string; semaine?: string }> };

async function settle<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export default async function Page({ searchParams }: Props) {
  const viewer = await requirePermission("VIEW_DIVISION");
  const scope = scopeOf(viewer);
  const at = now();
  const current = currentWeek(at);
  const sp = await searchParams;
  const asked = parseWeek(sp.annee, sp.semaine);
  const week = asked && compareWeeks(asked, current) <= 0 ? asked : current;

  const frame = await getDivisionFrame(scope);
  const weeks = Array.from({ length: TREND_WEEKS }, (_, i) => shiftWeek(week, i - TREND_WEEKS + 1));
  const frames = weeks.map((w) => weekFrame(w, frame.settings));
  const [states, sources] = await Promise.all([settle(getWeekStates(scope, frame, weeks)), settle(getDriftSources(scope, frame, at))]);

  const weekCapacity = sum(frames.at(-1)!.expected);
  const table = states ? teamTable({ teams: frame.teams, people: frame.people, states, week, weekCapacity, threshold: frame.threshold }) : null;
  const kpis = table ? kpiTexts(table.total) : null;
  const columns = states
    ? trend({ weeks, states, persons: frame.people.length, weekCapacity: frames.map((f) => sum(f.expected)), current })
    : null;
  const drifts: Drift[] | null =
    table && states && sources
      ? sortDrifts([
          ...budgetDrifts(sources.projects),
          ...underfillDrifts(table.rows, week, frame.threshold),
          ...lateDrifts(sources.late, frame.reminderDays),
          ...missingDrifts({ people: frame.people, states, weeks, expected: frames.map((f) => sum(f.expected)), now: at, deadlines: frames.map((f) => f.deadline) }),
        ])
      : null;
  const teamCount = frame.teams.length;
  const recent = Array.from({ length: TREND_WEEKS }, (_, i) => ({ week: shiftWeek(current, -i) }));

  return (
    <main className="container ts-stack">
      <div className="ts-head" style={{ alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h1>{t(d.title, { name: frame.name })}</h1>
          <p className="text-secondary">
            {t(d.summary, { teams: plural(teamCount, d.teamsOne, d.teamsMany), people: plural(frame.people.length, d.peopleOne, d.peopleMany) })}
          </p>
        </div>
        <DivisionWeekNav week={week} current={current} recent={recent} />
      </div>

      {kpis && table ? (
        <ul aria-label={t(d.kpis, { week: week.week })} className="ts-kpis ts-kpis-4">
          <li className="card" style={{ gap: 5 }}>
            <span className="text-secondary">{d.fill}</span>
            <span className="h1">{kpis.fill}</span>
            <span className="small">{kpis.fillDetail}</span>
          </li>
          <li className="card" style={{ gap: 5 }}>
            <span className="text-secondary">{d.submitted}</span>
            <span className="h1">{kpis.submitted}</span>
            <span className="small">{kpis.submittedDetail}</span>
          </li>
          <li className="card" style={{ gap: 5 }}>
            <span className="text-secondary">{d.validated}</span>
            <span className="h1">{kpis.validated}</span>
            <span className="small">{kpis.validatedDetail}</span>
          </li>
          <li className="card card-strong" style={{ gap: 5 }}>
            <span className="text-secondary">{d.drifts}</span>
            {drifts ? (
              <>
                <span className="h1">{drifts.length}</span>
                <span className="small">{drifts.length > 0 ? <a href="#derives">{d.seeDrifts}</a> : d.noDrift}</span>
              </>
            ) : (
              <span className="small">{d.blockError}</span>
            )}
          </li>
        </ul>
      ) : (
        <BlockError />
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "stretch" }}>
        <section className="card" aria-labelledby="titre-equipes" style={{ flex: "3 1 480px", minWidth: 0 }}>
          <h2 className="h4" id="titre-equipes">{t(d.teamsTitle, { week: week.week })}</h2>
          {table ? (
            <TableScroll>
              <table className="table">
                <caption className="visually-hidden">{d.teamsCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col">{d.colTeam}</th>
                    <th scope="col" style={{ width: 180 }}>{d.colFill}</th>
                    <th scope="col" className="num">{d.colSubmitted}</th>
                    <th scope="col" className="num">{d.colValidated}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => (
                    <tr key={r.id} id={teamAnchor(r.id)}>
                      <th scope="row">
                        {r.name}
                        <br />
                        <span className="small text-secondary" style={{ fontWeight: 400 }}>
                          {r.manager ? t(d.teamSub, { manager: r.manager, n: r.persons }) : t(d.teamSubNoManager, { n: r.persons })}
                        </span>
                      </th>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <span>{fillText(r)}</span>
                          <Progress value={r.fill} label={t(d.fillLabel, { name: r.name })} tone={r.under ? "danger" : undefined} />
                          {r.under && (
                            <span className="badge bg-danger" style={{ alignSelf: "flex-start" }}>{t(d.underThreshold, { threshold: pct(frame.threshold) })}</span>
                          )}
                        </div>
                      </td>
                      <td className="num">{t(d.ratio, { n: r.submitted, total: r.persons })}</td>
                      <td className="num">{t(d.ratio, { n: r.validated, total: r.persons })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">{d.divisionRow}</th>
                    <td>{fillText(table.total)}</td>
                    <td className="num">{t(d.ratio, { n: table.total.submitted, total: table.total.persons })}</td>
                    <td className="num">{t(d.ratio, { n: table.total.validated, total: table.total.persons })}</td>
                  </tr>
                </tfoot>
              </table>
            </TableScroll>
          ) : (
            <BlockError />
          )}
        </section>

        <figure className="card" style={{ flex: "2 1 320px", minWidth: 0 }}>
          <figcaption className="h4">{d.trendTitle}</figcaption>
          {columns ? (
            <>
              <div role="img" aria-label={columns.map((c) => c.title).join(" ; ")}>
                <Columns columns={columns} />
              </div>
              <p className="small text-secondary">{d.trendNote}</p>
            </>
          ) : (
            <BlockError />
          )}
        </figure>
      </div>

      <section id="derives" aria-labelledby="titre-derives" className="ts-section">
        <div className="ts-head-start">
          <h2 className="h3" id="titre-derives">{d.drifts}</h2>
          {drifts && drifts.length > 0 && <span className="badge bg-danger">{plural(drifts.length, d.driftsCountOne, d.driftsCountMany)}</span>}
        </div>
        {!drifts ? (
          <BlockError />
        ) : drifts.length === 0 ? (
          <EmptyState title={d.noDrift} headingLevel={3}>{d.noDriftText}</EmptyState>
        ) : (
          <TableScroll>
            <table className="table">
              <caption className="visually-hidden">{d.driftsCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{d.colType}</th>
                  <th scope="col">{d.colObject}</th>
                  <th scope="col">{d.colGap}</th>
                  <th scope="col">{d.colOwner}</th>
                  <th scope="col">{d.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {drifts.map((drift) => {
                  const row = driftRow(drift);
                  return (
                    <tr key={drift.key}>
                      <td><span className={`badge bg-${row.tone}`}>{row.type}</span></td>
                      <th scope="row">{row.object}</th>
                      <td>{row.gap}</td>
                      <td>{row.owner}</td>
                      <td>
                        {row.action.kind === "link" ? (
                          <a href={row.action.href} aria-label={`${row.action.label} : ${row.object}`}>{row.action.label}</a>
                        ) : drift.kind === "LATE_VALIDATION" ? (
                          <RemindButton label={row.action.label} ariaLabel={`${row.action.label} : ${row.owner}`} target={{ kind: "manager", managerId: drift.managerId }} />
                        ) : drift.kind === "MISSING" ? (
                          <RemindButton label={row.action.label} ariaLabel={`${row.action.label} : ${row.object}`} target={{ kind: "person", personId: drift.personId, week: drift.week }} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>
    </main>
  );
}
