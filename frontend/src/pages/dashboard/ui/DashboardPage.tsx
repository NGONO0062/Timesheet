// Écran 02 : tableau de bord staff, règles v2 (docs/design-v2.md, §5) : une seule action
// principale (la plus urgente), pas de doublon entre « À faire » et « Dernières semaines »,
// « Mes projets » replié, pas de carte dans une carte.
import { Link } from "react-router";
import { dayOf, useDashboard, type Dashboard, type WeekSummary } from "@/entities/timesheet";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import {
  capitalize,
  formatDate,
  formatDayMonth,
  formatDays,
  formatDaysOf,
  formatFromTo,
  formatLongDate,
  formatPercent,
  formatRange,
  formatTime,
  formatWeekdayDay,
  zonedDay,
} from "@/shared/lib/format";
import { addDays } from "@/shared/lib/iso-week";
import type { DayStatus } from "@/shared/lib/status";
import { Accordion } from "@/shared/ui/Disclosure";
import { Alert, Badge, Mark, Placeholder, Progress, Table } from "@/shared/ui/Display";
import { EmptyState } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";

const d = dict.dashboard;

const BUTTON = "inline-flex min-h-control items-center justify-center rounded-md border-2 px-btn-x py-btn-y font-bold no-underline whitespace-nowrap";
const PRIMARY = cx(BUTTON, "border-primary bg-primary text-black hover:border-black hover:bg-black hover:text-white");
const SECONDARY = cx(BUTTON, "border-black bg-white text-black hover:bg-black hover:text-white");

const weekHref = (w: { year: number; week: number }) => `/saisie/${w.year}/${w.week}`;
const daysOf = (w: WeekSummary) => {
  const monday = dayOf(w.monday);
  return [monday, addDays(monday, 4)] as const;
};
/** « 16–20 mars 2026 », ou « 16–20 mars » sans l'année. */
const periodOf = (w: WeekSummary, withYear = true) => formatRange(...daysOf(w), withYear);
/** « Du 9 au 13 mars 2026 », dans une phrase. */
const fromToOf = (w: WeekSummary) => formatFromTo(...daysOf(w));

function Todo({ data }: { data: Dashboard }) {
  return (
    <section className="flex flex-col gap-20" aria-labelledby="a-faire">
      <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
        <h2 id="a-faire" className="text-h3">
          {d.todoTitle}
        </h2>
        {data.todo.length > 0 && <Badge tone="warning">{t(data.todo.length > 1 ? d.todoCountMany : d.todoCountOne, { n: data.todo.length })}</Badge>}
      </div>
      {data.todo.length === 0 ? (
        <p role="status">{d.todoEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {data.todo.map((item, i) => {
            const w = item.week;
            const missing = item.kind === "missing";
            return (
              <li
                key={`${w.year}-${w.week}`}
                className="flex flex-col gap-10 border-b-2 border-gray-999 py-10 first:border-t-2 first:border-t-black md:flex-row md:items-center md:justify-between md:gap-20"
              >
                <div className="flex min-w-0 flex-1 items-start gap-10">
                  <Mark tone={missing ? "warning" : "danger"} />
                  <div className="flex flex-col gap-5">
                    <p className="font-bold">{missing ? t(d.missingTitle, { week: w.week }) : t(d.rejectedTitle, { week: w.week, name: data.managerName ?? "" })}</p>
                    <p className="hidden text-sm text-gray-595 md:block">
                      {missing
                        ? t(d.missingDetail, { period: fromToOf(w), hours: formatDays(w.expected - w.filled), deadline: formatDayMonth(zonedDay(new Date(w.deadline))) })
                        : t(d.rejectedDetail, { period: fromToOf(w) })}
                    </p>
                    <p className="text-sm text-gray-595 md:hidden">
                      {missing ? t(d.missingDetailShort, { range: periodOf(w), hours: formatDays(w.expected - w.filled) }) : t(d.rejectedDetailShort, { range: periodOf(w) })}
                    </p>
                  </div>
                </div>
                {/* Une seule action principale : la plus urgente, en tête de liste. */}
                <Link className={cx(i === 0 ? PRIMARY : SECONDARY, "w-full md:w-auto")} to={weekHref(w)}>
                  {missing ? t(d.missingAction, { week: w.week }) : t(d.rejectedAction, { week: w.week })}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CurrentWeek({ data }: { data: Dashboard }) {
  const w = data.current.week;
  const deadline = new Date(w.deadline);
  const submitted = w.status === "SUBMITTED" || w.status === "VALIDATED";
  // Aujourd'hui : le dernier jour qui n'est pas à venir.
  const todayIndex = data.current.days.filter((x) => !x.isFuture).length - 1;
  const days = data.current.days.map((day, i) => ({
    date: day.date,
    today: i === todayIndex,
    label: capitalize(formatWeekdayDay(dayOf(day.date))),
    status: (day.expected === 0 ? "UPCOMING" : day.filled ? "COMPLETE" : day.isFuture ? "UPCOMING" : "TODO") as DayStatus,
  }));
  return (
    <section className="flex flex-col gap-20" aria-labelledby="semaine-en-cours">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
          <h2 id="semaine-en-cours" className="text-h3">
            {d.weekTitle}
          </h2>
          <StatusBadge kind="timesheet" value={w.status} />
        </div>
        <p className="font-bold">{t(dict.week.labelWithRange, { week: w.week, range: periodOf(w) })}</p>
      </div>
      <div className="flex flex-col gap-10">
        <div className="flex items-baseline justify-between gap-10">
          <p>
            <span className="text-h2 font-bold">{formatDays(w.filled)}</span> <span className="hidden md:inline">{t(d.enteredOf, { expected: formatDays(w.expected) })}</span>
            <span className="md:hidden">{t(d.enteredOfShort, { expected: formatDays(w.expected) })}</span>
          </p>
          <p className="font-bold">{formatPercent(w.filled / Math.max(1, w.expected))}</p>
        </div>
        <Progress value={(w.filled / Math.max(1, w.expected)) * 100} label={d.progressLabel} tone={w.filled === w.expected ? "success" : undefined} />
      </div>
      {/* Bureau : une case par jour ; mobile : une ligne par jour. */}
      <ul className="hidden grid-cols-5 gap-10 md:grid" aria-label={d.hoursPerDay}>
        {days.map((day) => (
          <li key={day.date} className={cx("flex flex-col items-start gap-5 rounded-md border-2 p-10", day.today ? "border-black" : "border-gray-999")}>
            <span className="text-sm">{day.today ? d.today : day.label}</span>
            <StatusBadge kind="day" value={day.status} />
          </li>
        ))}
      </ul>
      <ul className="flex flex-col rounded-md border-2 border-gray-999 md:hidden" aria-label={d.hoursPerDay}>
        {days.map((day) => (
          <li key={day.date} className="flex items-center justify-between gap-10 border-b-2 border-gray-999 px-10 py-10 last:border-b-0">
            <span className={day.today ? "font-bold" : undefined}>
              {day.label}
              {day.today && <span className="sr-only">{d.todaySuffix}</span>}
            </span>
            <StatusBadge kind="day" value={day.status} />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between md:gap-20">
        <p className="text-sm">
          {/* Semaine soumise ou validée : l'étiquette de statut le dit, la date est sur l'écran de saisie. */}
          {submitted
            ? null
            : w.status === "MISSING"
              ? t(d.deadlinePassed, { date: formatDate(zonedDay(deadline)) })
              : t(d.deadline, { date: formatLongDate(zonedDay(deadline)), time: formatTime(deadline) })}
        </p>
        {/* Bouton principal seulement si rien d'autre n'attend dans « À faire ». */}
        <Link className={cx(data.todo.length === 0 && !submitted ? PRIMARY : SECONDARY, "w-full md:w-auto")} to={weekHref(w)}>
          {submitted ? d.consult : d.continue}
        </Link>
      </div>
    </section>
  );
}

function Projects({ data }: { data: Dashboard }) {
  if (data.projects.length === 0) {
    return (
      <EmptyState headingLevel={2} title={d.projectsEmptyTitle}>
        {d.projectsEmptyText}
      </EmptyState>
    );
  }
  return (
    <Accordion
      items={[
        {
          key: "projets",
          title: `${d.projectsTitle} (${data.projects.length})`,
          content: (
            <ul className="flex flex-col">
              {data.projects.map((p) => (
                <li key={p.code} className="flex flex-wrap items-center justify-between gap-x-20 gap-y-5 border-b-2 border-gray-999 py-10 last:border-b-0">
                  <span className="flex flex-col gap-5">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-sm text-gray-595">
                      {p.code} · {p.activities.join(", ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-20">
                    <StatusBadge kind="project" value={p.status} />
                    <span className="text-sm">{p.acceptsEntry ? t(d.hoursThisWeek, { hours: formatDays(p.daysThisWeek) }) : d.noProjectReason}</span>
                  </span>
                </li>
              ))}
            </ul>
          ),
        },
      ]}
    />
  );
}

function History({ data }: { data: Dashboard }) {
  if (data.recent.length === 0) return null;
  return (
    <section className="flex flex-col gap-20" aria-labelledby="dernieres-semaines">
      <h2 id="dernieres-semaines" className="text-h3">
        {d.historyTitle}
      </h2>
      <div className="hidden md:block">
        <Table caption={d.historyCaption}>
          <thead>
            <tr>
              <th scope="col">{d.colWeek}</th>
              <th scope="col">{d.colPeriod}</th>
              <th scope="col" className="text-right">
                {d.colHours}
              </th>
              <th scope="col">{d.colStatus}</th>
              <th scope="col">{d.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.map((w) => {
              const consult = w.status === "SUBMITTED" || w.status === "VALIDATED";
              return (
                <tr key={`${w.year}-${w.week}`}>
                  <th scope="row">{t(dict.week.label, { week: w.week })}</th>
                  <td>{periodOf(w)}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {w.filled} / {w.expected}
                  </td>
                  <td>
                    <StatusBadge kind="timesheet" value={w.status} />
                  </td>
                  <td>
                    <Link to={weekHref(w)}>{consult ? d.actionConsult : d.actionContinue}</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      {/* Mobile : une ligne par semaine, le lien porte le numéro de semaine. */}
      <ul className="flex flex-col rounded-md border-2 border-gray-999 md:hidden" aria-label={d.historyCaption}>
        {data.recent.map((w) => (
          <li key={`${w.year}-${w.week}`} className="flex items-center justify-between gap-10 border-b-2 border-gray-999 px-10 py-10 last:border-b-0">
            <span className="flex flex-col gap-5">
              <Link to={weekHref(w)} className="font-bold">
                {t(dict.week.label, { week: w.week })}
              </Link>
              <span className="text-sm text-gray-595">{`${periodOf(w, false)} · ${formatDaysOf(w.filled, w.expected)}`}</span>
            </span>
            <StatusBadge kind="timesheet" value={w.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardPage() {
  const query = useDashboard();
  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <h1>{d.title}</h1>
        <p className="sr-only" role="status">
          {d.loading}
        </p>
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="flex flex-col gap-30">
        <h1>{d.title}</h1>
        <Alert tone="danger" role="alert" heading={d.errorTitle}>
          <p>{d.errorText}</p>
          <p>{d.errorHelp}</p>
        </Alert>
      </main>
    );
  }
  const data = query.data;
  const subtitle = [data.isIntern ? d.intern : null, data.divisionName, data.managerName ? t(d.managerOf, { name: data.managerName }) : null].filter(Boolean).join(" · ");
  return (
    <main className="flex flex-col gap-60">
      <div className="flex flex-col gap-10">
        <h1>{t(d.hello, { name: data.firstName })}</h1>
        <p className="text-gray-595">{subtitle}</p>
      </div>
      <Todo data={data} />
      <CurrentWeek data={data} />
      <Projects data={data} />
      <History data={data} />
    </main>
  );
}
