// Écran 2 : tableau de bord staff (PROMPT.md §9.1, planches 02-Tableau-de-bord et
// 02-Tableau-de-bord-mobile). Se lit de haut en bas, du plus urgent au moins urgent.
import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/ods/Icon";
import { Progress, Tag } from "@/components/ods/Display";
import { EmptyState } from "@/components/ts/States";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { now } from "@/lib/clock";
import {
  currentWeek, getEntrySettings, getProfile, getValidator, getWeekSheet, listAttendanceToSign, listMyProjects,
  listRejectedSheets, listWeekSummaries, weekFrame,
} from "@/lib/data/timesheets";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import {
  formatDate, formatDateAt, formatDayMonth, formatFromTo, formatHours, formatHoursOf, formatLongDate, formatRange,
  formatPercent, formatTime, zonedDay,
} from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { compareWeeks, isoWeekOf, isoWeekday, sameDay, shiftWeek, todayInDivision, type IsoWeek } from "@/lib/iso-week";
import { entryNotice } from "@/lib/projects/rules";
import { attendanceHref, entryHref, parseWeek } from "@/lib/routes";
import { actionLabel, historyAction, missingWeeks, projectPeriod, startsShort, todoCount, weeksBack } from "@/lib/timesheet/dashboard";
import { dayStatus, displayStatus, sum } from "@/lib/timesheet/rules";
import { isEditable } from "@/lib/timesheet/transitions";
import { roleLabel } from "@/lib/viewer";
import { WeekNav } from "./WeekNav";

export const metadata: Metadata = { title: dict.dashboard.title };

const d = dict.dashboard;
/** Au plus douze semaines remontées dans « À faire ». */
const LOOKBACK = 12;

type Props = { searchParams: Promise<{ annee?: string; semaine?: string }> };

export default async function Page({ searchParams }: Props) {
  const viewer = await requirePermission("ENTER_TIME");
  const scope = scopeOf(viewer);
  const at = now();
  const today = todayInDivision(at);
  const current = currentWeek(at);
  const settings = await getEntrySettings(scope);
  const profile = await getProfile(scope);
  const sinceWeek = isoWeekOf(profile.since);

  // Semaine affichée dans la carte : la semaine courante, ou celle choisie au sélecteur.
  const sp = await searchParams;
  const asked = parseWeek(sp.annee, sp.semaine);
  const week = asked && (settings.allowFutureWeeks || compareWeeks(asked, current) <= 0) ? asked : current;

  const oldest = compareWeeks(sinceWeek, shiftWeek(current, -LOOKBACK)) > 0 ? sinceWeek : shiftWeek(current, -LOOKBACK);
  const tracked = compareWeeks(oldest, current) <= 0 ? weeksBack(current, oldest) : [current];
  const frame = weekFrame(week, settings);

  const [validator, summaries, sheet, projects, rejected, attendance] = await Promise.all([
    getValidator(scope),
    listWeekSummaries(scope, tracked.some((w) => compareWeeks(w, week) === 0) ? tracked : [...tracked, week]),
    getWeekSheet(scope, week, frame.days),
    listMyProjects(scope, current),
    listRejectedSheets(scope),
    profile.isIntern ? listAttendanceToSign(scope) : Promise.resolve([]),
  ]);

  const recordOf = (w: IsoWeek) => {
    const f = weekFrame(w, settings);
    const s = summaries.find((x) => compareWeeks(x.week, w) === 0);
    const stored = s?.stored ?? null;
    return { week: w, frame: f, stored, hours: s?.hours ?? 0, expected: sum(f.expected), deadline: f.deadline, status: displayStatus(stored, f.deadline, at) };
  };
  const records = tracked.map(recordOf);

  // --- À faire -----------------------------------------------------------------
  type Todo = { key: string; title: string; detail: string; detailShort: string; action: string; href: string };
  const todos: Todo[] = [
    ...missingWeeks(records, at).map((r): Todo => ({
      key: `manquante-${r.week.year}-${r.week.week}`,
      title: t(d.missingTitle, { week: r.week.week }),
      detail: t(d.missingDetail, {
        period: formatFromTo(r.frame.days[0]!, r.frame.days.at(-1)!),
        hours: formatHours(r.expected - r.hours),
        deadline: formatDayMonth(zonedDay(r.deadline)),
      }),
      detailShort: t(d.missingDetailShort, { range: formatRange(r.frame.days[0]!, r.frame.days.at(-1)!), hours: formatHours(r.expected - r.hours) }),
      action: t(d.missingAction, { week: r.week.week }),
      href: entryHref(r.week),
    })),
    ...rejected.map((r): Todo => {
      const f = weekFrame(r.week, settings);
      return {
        key: `rejetee-${r.week.year}-${r.week.week}`,
        title: t(d.rejectedTitle, { week: r.week.week, name: r.decidedBy }),
        detail: t(d.rejectedDetail, { period: formatFromTo(f.days[0]!, f.days.at(-1)!) }),
        detailShort: t(d.rejectedDetailShort, { range: formatRange(f.days[0]!, f.days.at(-1)!) }),
        action: t(d.rejectedAction, { week: r.week.week }),
        href: entryHref(r.week),
      };
    }),
    ...attendance.map((a): Todo => {
      const generated = formatDate(zonedDay(a.generatedAt));
      return {
        key: `presence-${a.year}-${a.month}`,
        title: t(d.attendanceTitle, { month: `${dict.months[a.month - 1]} ${a.year}` }),
        detail: t(d.attendanceDetail, { hours: formatHours(a.validatedHours), date: generated }),
        detailShort: t(d.attendanceDetailShort, { hours: formatHours(a.validatedHours), date: generated }),
        action: d.attendanceAction,
        href: attendanceHref(a.year, a.month),
      };
    }),
  ];

  // --- Semaine affichée ---------------------------------------------------------
  const dayHours = frame.days.map((_, j) => sum(sheet.lines.map((l) => l.hours[j] ?? 0)));
  const flaggedDays = frame.days.map((_, j) => sheet.lines.some((l) => l.flagged[j]));
  const total = sum(dayHours);
  const expected = sum(frame.expected);
  const ratio = expected > 0 ? total / expected : 0;
  const status = displayStatus(sheet.stored, frame.deadline, at);
  const editable = sheet.stored === null || isEditable(sheet.stored, settings.lockAfterValidation);
  const canEnter = sheet.lines.length > 0 || projects.some((p) => p.status === "IN_PROGRESS");
  const deadlineText = (() => {
    if (sheet.stored === "SUBMITTED" && sheet.submittedAt) return t(d.submittedOn, { date: formatDateAt(sheet.submittedAt), name: validator?.name ?? "" });
    if (sheet.stored === "VALIDATED" && sheet.decidedAt) return t(d.validatedOn, { date: formatDateAt(sheet.decidedAt) });
    if (at.getTime() > frame.deadline.getTime()) return t(d.deadlinePassed, { date: formatDate(zonedDay(frame.deadline)) });
    return t(d.deadline, { date: formatLongDate(zonedDay(frame.deadline)), time: formatTime(frame.deadline) });
  })();
  const recent = records.slice(0, 6).map((r) => ({ week: r.week, status: r.status }));
  const days = frame.days.map((day, j) => ({
    key: day.toISOString(),
    label: `${dict.weekdaysShort[isoWeekday(day)]} ${day.getUTCDate()}`,
    today: sameDay(day, today),
    hours: dayHours[j]!,
    status: dayStatus({ total: dayHours[j]!, expected: frame.expected[j]!, isFuture: day.getTime() > today.getTime(), flagged: flaggedDays[j] }),
  }));

  // --- Dernières semaines -------------------------------------------------------
  const history = records.slice(0, 4);
  const subtitle = [profile.isIntern ? d.intern : roleLabel(viewer.role), profile.divisionName];

  const primary = canEnter ? (
    <Link className="btn btn-primary ts-cta" href={entryHref(week)}>
      {editable ? d.continue : d.consult}
    </Link>
  ) : (
    <button className="btn btn-primary ts-cta" type="button" disabled aria-describedby="raison-saisie">
      {d.continue}
    </button>
  );

  return (
    <main className="container ts-stack">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1>{t(d.hello, { name: profile.firstName })}</h1>
        <p className="text-secondary ts-wide">{[...subtitle, ...(validator ? [t(d.managerOf, { name: validator.name })] : [])].join(" · ")}</p>
        <p className="small text-secondary ts-narrow">{subtitle.join(" · ")}</p>
      </div>

      <section className="ts-section" aria-labelledby="titre-afaire">
        <div className="ts-head-start">
          <h2 className="h3" id="titre-afaire">{d.todoTitle}</h2>
          {todos.length > 0 && <span className="badge bg-warning">{todoCount(todos.length)}</span>}
        </div>
        {todos.length === 0 ? (
          <p className="ts-save" role="status">
            <Mark tone="success" />
            {d.todoEmpty}
          </p>
        ) : (
          <ul className="list-group">
            {todos.map((item) => (
              <li className="list-group-item ts-todo-item" key={item.key}>
                <div className="ts-todo-text">
                  <Mark tone="warning" />
                  <div>
                    <span className="fw-bold">{item.title}</span>
                    <span className="small text-secondary ts-wide">{item.detail}</span>
                    <span className="small text-secondary ts-narrow">{item.detailShort}</span>
                  </div>
                </div>
                <Link className="btn" href={item.href}>
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card-strong" aria-labelledby="titre-semaine">
        <div className="ts-head" style={{ gap: 10 }}>
          <h2 className="h3" id="titre-semaine">{d.weekTitle}</h2>
          <StatusBadge kind="timesheet" value={status} />
        </div>
        <div className="ts-wide">
          <WeekNav week={week} current={current} allowFutureWeeks={settings.allowFutureWeeks} recent={recent} />
        </div>
        <div className="ts-narrow">
          <WeekNav week={week} current={current} allowFutureWeeks={settings.allowFutureWeeks} recent={recent} large />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="ts-head" style={{ alignItems: "baseline", gap: 10 }}>
            <p>
              <span className="h2">{formatHours(total)}</span>{" "}
              <span className="ts-wide">{t(d.enteredOf, { expected: formatHours(expected) })}</span>
              <span className="ts-narrow">{t(d.enteredOfShort, { expected: formatHours(expected) })}</span>
            </p>
            <p className="fw-bold">{formatPercent(ratio)}</p>
          </div>
          <Progress value={ratio * 100} label={d.progressLabel} />
        </div>
        <ul className="ts-days ts-wide" aria-label={d.hoursPerDay}>
          {days.map((day) => (
            <li key={day.key} className={day.today ? "is-today" : undefined}>
              <span className="small text-secondary">{day.today ? d.today : day.label}</span>
              <span className="h5">{formatHours(day.hours)}</span>
              <StatusBadge kind="day" value={day.status} />
            </li>
          ))}
        </ul>
        <ul className="list-group ts-list-tight ts-narrow" aria-label={d.hoursPerDay}>
          {days.map((day) => (
            <li className="list-group-item" key={day.key}>
              <span className={day.today ? "fw-bold" : undefined}>
                {day.label}
                {day.today && <span className="visually-hidden">{d.todaySuffix}</span>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="fw-bold">{formatHours(day.hours)}</span>
                <StatusBadge kind="day" value={day.status} />
              </span>
            </li>
          ))}
        </ul>
        <div className="ts-head">
          <p className="small" id="raison-saisie">
            {canEnter ? deadlineText : d.noProjectReason}
          </p>
          {primary}
        </div>
      </section>

      <section className="ts-section" aria-labelledby="titre-projets">
        <h2 className="h3" id="titre-projets">{d.projectsTitle}</h2>
        {projects.length === 0 ? (
          <EmptyState title={d.projectsEmptyTitle}>{d.projectsEmptyText}</EmptyState>
        ) : (
          <>
            <ul className="list-group ts-wide">
              {projects.map((p) => {
                const notice = entryNotice(p.status);
                return (
                  <li className="list-group-item" key={p.id}>
                    <div className="ts-project-main">
                      <span className="fw-bold">{p.name}</span>
                      <span className="small text-secondary">{`${p.code} · ${projectPeriod(p, today)}`}</span>
                    </div>
                    <span className="ts-project-status">
                      <StatusBadge kind="project" value={p.status} />
                    </span>
                    <div className="ts-project-tags">
                      {p.activities.map((a) => (
                        <Tag key={a}>{a}</Tag>
                      ))}
                    </div>
                    {notice ? (
                      <span className="small text-secondary ts-project-hours">{notice}</span>
                    ) : (
                      <span className="fw-bold ts-project-hours">{t(d.hoursThisWeek, { hours: formatHours(p.hours) })}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <ul className="list-group ts-list-tight ts-narrow">
              {projects.map((p) => {
                const notice = entryNotice(p.status);
                return (
                  <li className="list-group-item" key={p.id}>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, flex: "1 1 180px" }}>
                      <span className="fw-bold">{p.name}</span>
                      <StatusBadge kind="project" value={p.status} />
                    </span>
                    <span className="small">{notice ? (startsShort(p.startDate, today) ?? notice) : formatHours(p.hours)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="ts-section" aria-labelledby="titre-histo">
        <h2 className="h3" id="titre-histo">{d.historyTitle}</h2>
        <div className="table-responsive ts-wide">
          <table className="table">
            <caption className="visually-hidden">{d.historyCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{d.colWeek}</th>
                <th scope="col">{d.colPeriod}</th>
                <th scope="col" className="num">{d.colHours}</th>
                <th scope="col">{d.colStatus}</th>
                <th scope="col">{d.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={`${r.week.year}-${r.week.week}`}>
                  <th scope="row">{t(dict.week.label, { week: r.week.week })}</th>
                  <td>{formatRange(r.frame.days[0]!, r.frame.days.at(-1)!)}</td>
                  <td className="num">{formatHoursOf(r.hours, r.expected)}</td>
                  <td>
                    <StatusBadge kind="timesheet" value={r.status} />
                  </td>
                  <td>
                    <Link href={entryHref(r.week)}>{actionLabel(historyAction(r.status, r.hours))}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-group ts-list-tight ts-narrow">
          {history.slice(1).map((r) => (
            <li className="list-group-item" key={`${r.week.year}-${r.week.week}`}>
              <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <Link href={entryHref(r.week)}>{t(dict.week.label, { week: r.week.week })}</Link>
                <span className="small text-secondary">{`${formatRange(r.frame.days[0]!, r.frame.days.at(-1)!, false)} · ${formatHoursOf(r.hours, r.expected)}`}</span>
              </span>
              <StatusBadge kind="timesheet" value={r.status} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
