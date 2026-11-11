// Écran 11 : vue consolidée de la division (PROMPT.md §9.6, planche 11-Vue-consolidee). Semaine
// dans l'adresse ; les blocs (semaine, dérives) se chargent séparément : un bloc en panne le dit,
// garde le reste de la page et propose « Réessayer » (§12).
import { Link, useNavigate, useSearchParams } from "react-router";
import { driftRow, fillText, kpiTexts, pct, teamAnchor, trendColumns, useDivisionHead, useDrifts, useRemind, useWeekBlock, type Drift } from "@/entities/division";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { compareWeeks, isValidIsoWeek, shiftWeek, type IsoWeek } from "@/shared/lib/iso-week";
import { Button } from "@/shared/ui/Button";
import { Alert, Badge, Mark, Placeholder, Progress, Table } from "@/shared/ui/Display";
import { EmptyState } from "@/shared/ui/States";
import { Columns } from "@/widgets/charts";
import { WeekSelector } from "@/widgets/week-selector";

const d = dict.division;
const CARD_BASE = "flex flex-col gap-5 rounded-md border-2 p-20";
const CARD = `${CARD_BASE} border-gray-999`;
const plural = (n: number, one: string, many: string) => t(n > 1 ? many : one, { n });

function BlockError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert tone="danger" role="alert" action={<Button onClick={onRetry}>{dict.form.retry}</Button>}>
      <p>{d.blockError}</p>
    </Alert>
  );
}

export function DivisionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const asked = { year: Number(params.get("annee")), week: Number(params.get("semaine")) };
  const week: IsoWeek | null = Number.isInteger(asked.year) && Number.isInteger(asked.week) && isValidIsoWeek(asked) ? asked : null;
  const head = useDivisionHead(week);

  if (head.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <h1>{d.screenTitle}</h1>
        <p className="sr-only" role="status">
          {d.loading}
        </p>
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (head.isError) {
    return (
      <main className="flex flex-col gap-30">
        <h1>{d.screenTitle}</h1>
        <Alert tone="danger" role="alert" heading={d.errorTitle} action={<Button onClick={() => void head.refetch()}>{dict.form.retry}</Button>}>
          <p>{d.errorText}</p>
        </Alert>
      </main>
    );
  }

  const { name, teams, people, current, threshold } = head.data;
  const shown = head.data.week;
  const recent = Array.from({ length: 6 }, (_, i) => ({ week: shiftWeek(current, -i) }));

  return (
    <main className="flex flex-col gap-30">
      <div className="flex flex-wrap items-end justify-between gap-20">
        <div className="flex flex-col gap-10">
          <h1>{t(d.title, { name })}</h1>
          <p className="text-gray-595">{t(d.summary, { teams: plural(teams, d.teamsOne, d.teamsMany), people: plural(people, d.peopleOne, d.peopleMany) })}</p>
        </div>
        <WeekSelector
          week={shown}
          current={current}
          recent={recent}
          allowFutureWeeks={false}
          nextDisabledLabel={d.nextDisabled}
          onNavigate={(w) => navigate(compareWeeks(w, current) === 0 ? "/division" : `/division?annee=${w.year}&semaine=${w.week}`)}
        />
      </div>
      <WeekBlocks week={shown} threshold={threshold} />
    </main>
  );
}

function WeekBlocks({ week, threshold }: { week: IsoWeek; threshold: number }) {
  const block = useWeekBlock(week);
  const drifts = useDrifts(week);
  const kpis = block.data ? kpiTexts(block.data.total) : null;

  return (
    <>
      {block.isPending ? (
        <Placeholder className="h-pad w-full" />
      ) : !kpis ? (
        <BlockError onRetry={() => void block.refetch()} />
      ) : (
        <ul aria-label={t(d.kpis, { week: week.week })} className="grid gap-20 sm:grid-cols-2 lg:grid-cols-4">
          <li className={CARD}>
            <span className="text-gray-595">{d.fill}</span>
            <span className="text-h1 font-bold">{kpis.fill}</span>
            <span className="text-sm">{kpis.fillDetail}</span>
          </li>
          <li className={CARD}>
            <span className="text-gray-595">{d.submitted}</span>
            <span className="text-h1 font-bold">{kpis.submitted}</span>
            <span className="text-sm">{kpis.submittedDetail}</span>
          </li>
          <li className={CARD}>
            <span className="text-gray-595">{d.validated}</span>
            <span className="text-h1 font-bold">{kpis.validated}</span>
            <span className="text-sm">{kpis.validatedDetail}</span>
          </li>
          <li className={cx(CARD_BASE, "border-black")}>
            <span className="text-gray-595">{d.drifts}</span>
            {drifts.data ? (
              <>
                <span className="text-h1 font-bold">{drifts.data.length}</span>
                <span className="text-sm">{drifts.data.length > 0 ? <a href="#derives">{d.seeDrifts}</a> : d.noDrift}</span>
              </>
            ) : drifts.isError ? (
              <span className="text-sm">{d.blockError}</span>
            ) : (
              <Placeholder className="h-control w-full" />
            )}
          </li>
        </ul>
      )}

      <div className="grid grid-cols-1 items-stretch gap-20 lg:grid-cols-report">
        <section className={cx(CARD, "gap-20")} aria-labelledby="titre-equipes">
          <h2 className="text-h4" id="titre-equipes">
            {t(d.teamsTitle, { week: week.week })}
          </h2>
          {block.isPending ? (
            <Placeholder className="h-pad w-full" />
          ) : !block.data ? (
            <BlockError onRetry={() => void block.refetch()} />
          ) : (
            <Table caption={d.teamsCaption}>
              <thead>
                <tr>
                  <th scope="col">{d.colTeam}</th>
                  <th scope="col">{d.colFill}</th>
                  <th scope="col" className="text-right">
                    {d.colSubmitted}
                  </th>
                  <th scope="col" className="text-right">
                    {d.colValidated}
                  </th>
                </tr>
              </thead>
              <tbody>
                {block.data.rows.map((r) => (
                  <tr key={r.id} id={teamAnchor(r.id)}>
                    <th scope="row">
                      {r.name}
                      <span className="block text-sm font-normal text-gray-595">{r.manager ? t(d.teamSub, { manager: r.manager, n: r.persons }) : t(d.teamSubNoManager, { n: r.persons })}</span>
                    </th>
                    <td>
                      <div className="flex flex-col gap-5">
                        <span className="whitespace-nowrap">{fillText(r)}</span>
                        <Progress value={r.fill} label={t(d.fillLabel, { name: r.name })} tone={r.under ? "danger" : undefined} />
                        {r.under && (
                          <span className="self-start">
                            <Badge tone="danger">
                              {t(d.underThreshold, { threshold: pct(threshold) })}
                            </Badge>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{t(d.ratio, { n: r.submitted, total: r.persons })}</td>
                    <td className="text-right tabular-nums">{t(d.ratio, { n: r.validated, total: r.persons })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{d.divisionRow}</th>
                  <td>{fillText(block.data.total)}</td>
                  <td className="text-right tabular-nums">{t(d.ratio, { n: block.data.total.submitted, total: block.data.total.persons })}</td>
                  <td className="text-right tabular-nums">{t(d.ratio, { n: block.data.total.validated, total: block.data.total.persons })}</td>
                </tr>
              </tfoot>
            </Table>
          )}
        </section>

        <figure className={cx(CARD, "gap-20")} aria-labelledby="titre-tendance">
          <figcaption className="text-h4 font-bold" id="titre-tendance">
            {d.trendTitle}
          </figcaption>
          {block.isPending ? (
            <Placeholder className="h-pad w-full" />
          ) : !block.data ? (
            <BlockError onRetry={() => void block.refetch()} />
          ) : (
            <>
              <Columns columns={trendColumns(block.data.trend)} label={trendColumns(block.data.trend).map((c) => c.title).join(" ; ")} />
              <p className="text-sm text-gray-595">{d.trendNote}</p>
            </>
          )}
        </figure>
      </div>

      <section id="derives" aria-labelledby="titre-derives" className="flex flex-col gap-20">
        <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
          <h2 className="text-h3" id="titre-derives">
            {d.drifts}
          </h2>
          {drifts.data && drifts.data.length > 0 && (
            <Badge tone="danger">
              {plural(drifts.data.length, d.driftsCountOne, d.driftsCountMany)}
            </Badge>
          )}
        </div>
        {drifts.isPending ? (
          <Placeholder className="h-pad w-full" />
        ) : !drifts.data ? (
          <BlockError onRetry={() => void drifts.refetch()} />
        ) : drifts.data.length === 0 ? (
          <EmptyState title={d.noDrift}>{d.noDriftText}</EmptyState>
        ) : (
          <Table caption={d.driftsCaption}>
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
              {drifts.data.map((drift) => (
                <DriftLine key={drift.key} drift={drift} />
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </>
  );
}

/** Ligne de dérive ; une relance écrit son résultat sous le bouton, dans une zone de statut. */
function DriftLine({ drift }: { drift: Drift }) {
  const row = driftRow(drift);
  const remind = useRemind();
  const code = remind.error instanceof ApiError ? (remind.error.body as { code?: string } | null)?.code : null;

  function send() {
    if (drift.kind === "LATE_VALIDATION") remind.mutate({ kind: "manager", managerId: drift.targetId });
    else if (drift.kind === "MISSING" && drift.year && drift.week) remind.mutate({ kind: "person", personId: drift.targetId, year: drift.year, week: drift.week });
  }

  return (
    <tr>
      <td>
        <Badge tone={row.tone}>
          {row.type}
        </Badge>
      </td>
      <th scope="row">{row.object}</th>
      <td>{row.gap}</td>
      <td>{row.owner}</td>
      <td>
        {row.action.kind === "link" ? (
          row.action.href.startsWith("#") ? (
            <a href={row.action.href} aria-label={`${row.action.label} : ${row.object}`}>
              {row.action.label}
            </a>
          ) : (
            <Link to={row.action.href} aria-label={`${row.action.label} : ${row.object}`}>
              {row.action.label}
            </Link>
          )
        ) : (
          <div className="flex flex-col items-start gap-5">
            {!remind.isSuccess && (
              <Button variant="link" aria-label={`${row.action.label} : ${row.action.kind === "remindManager" ? row.owner : row.object}`} disabled={remind.isPending} onClick={send}>
                {row.action.label}
              </Button>
            )}
            <span className="flex items-center gap-5 text-sm" role="status">
              {remind.isSuccess && (
                <>
                  <Mark tone="success" />
                  {t(d.reminded, { name: remind.data.name })}
                </>
              )}
              {remind.isError && (
                <>
                  <Mark tone="danger" />
                  {code === "nothingLate" ? d.nothingToRemind : d.remindFailed}
                </>
              )}
            </span>
          </div>
        )}
      </td>
    </tr>
  );
}
