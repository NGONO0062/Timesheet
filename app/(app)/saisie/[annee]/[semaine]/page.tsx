// Écran 3 : saisie hebdomadaire (PROMPT.md §9.2), avec la confirmation (écran 4)
// et l'état rejeté (écran 5).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { now } from "@/lib/clock";
import {
  currentWeek, getEntrySettings, getProfile, getValidator, getWeekSheet, listEligibleLines, listPreviousLines, listWeekSummaries,
  weekFrame,
} from "@/lib/data/timesheets";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { capitalize, formatDateAt, formatDateTime, formatLongDateAt, formatTime } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { compareWeeks, isoWeekOf, sameDay, shiftWeek, todayInDivision } from "@/lib/iso-week";
import { parseWeek } from "@/lib/routes";
import { weeksBack } from "@/lib/timesheet/dashboard";
import { displayStatus } from "@/lib/timesheet/rules";
import { isEditable } from "@/lib/timesheet/transitions";
import { roleLabel } from "@/lib/viewer";
import type { EntryView } from "./view";
import { WeekEntry } from "./WeekEntry";

export const metadata: Metadata = { title: dict.entry.title };

type Props = {
  params: Promise<{ annee: string; semaine: string }>;
  searchParams: Promise<{ soumise?: string }>;
};

const e = dict.entry;

export default async function Page({ params, searchParams }: Props) {
  const viewer = await requirePermission("ENTER_TIME");
  const scope = scopeOf(viewer);
  const { annee, semaine } = await params;
  const week = parseWeek(annee, semaine);
  if (!week) notFound();

  const at = now();
  const today = todayInDivision(at);
  const current = currentWeek(at);
  const settings = await getEntrySettings(scope);
  const frame = weekFrame(week, settings);
  const futureBlocked = !settings.allowFutureWeeks && compareWeeks(week, current) > 0;
  const profile = await getProfile(scope);

  const since = isoWeekOf(profile.since);
  const recentWeeks = weeksBack(current, shiftWeek(current, -5)).filter((w) => compareWeeks(w, since) >= 0);
  const [sheet, eligible, validator, summaries] = await Promise.all([
    getWeekSheet(scope, week, frame.days),
    futureBlocked ? Promise.resolve([]) : listEligibleLines(scope, week),
    getValidator(scope),
    listWeekSummaries(scope, recentWeeks),
  ]);
  const previous = futureBlocked ? [] : await listPreviousLines(scope, week, eligible);

  const editable = !futureBlocked && (sheet.stored === null || isEditable(sheet.stored, settings.lockAfterValidation));
  const validatorName = validator?.name ?? "";
  const { soumise } = await searchParams;

  let info: EntryView["info"] = null;
  if (sheet.stored === "SUBMITTED" && sheet.submittedAt) {
    info = { tone: "info", text: t(e.submittedInfo, { date: formatDateAt(sheet.submittedAt), name: validatorName }) };
  } else if (sheet.stored === "VALIDATED" && sheet.decidedAt) {
    const by = sheet.decidedBy ?? validatorName;
    const date = formatDateAt(sheet.decidedAt);
    // La fiche de présence reprend le mois du lundi de la semaine.
    const month = `${dict.months[frame.start.getUTCMonth()]} ${frame.start.getUTCFullYear()}`;
    info = {
      tone: "success",
      text: editable
        ? t(e.validatedEditable, { name: by, date })
        : t(profile.isIntern ? e.validatedInfoIntern : e.validatedInfo, { name: by, date, month }),
    };
  }

  const view: EntryView = {
    week,
    current,
    allowFutureWeeks: settings.allowFutureWeeks,
    futureBlocked,
    recent: summaries.map((s) => ({ week: s.week, status: displayStatus(s.stored, weekFrame(s.week, settings).deadline, at) })),
    days: frame.days.map((d) => d.toISOString()),
    expected: frame.expected,
    futureDays: frame.days.map((d) => d.getTime() > today.getTime()),
    todayIndex: frame.days.findIndex((d) => sameDay(d, today)),
    step: settings.step,
    hoursPerDay: settings.hoursPerDay,
    status: displayStatus(sheet.stored, frame.deadline, at),
    editable,
    rejected: sheet.stored === "REJECTED",
    lines: sheet.lines.map((l) => ({
      projectId: l.projectId,
      activityId: l.activityId,
      project: l.project,
      activity: l.activity,
      locked: l.projectStatus !== "IN_PROGRESS",
      hours: l.hours,
      flagged: l.flagged,
    })),
    comment: sheet.comment,
    eligible,
    previous,
    previousWeek: shiftWeek(week, -1).week,
    validator: validator ? { name: validator.name, role: roleLabel(validator.role).toLowerCase() } : null,
    savedTime: sheet.stored === "DRAFT" && sheet.updatedAt ? formatTime(sheet.updatedAt) : null,
    info,
    justSubmitted: soumise === "1" && sheet.stored === "SUBMITTED",
    rejection:
      sheet.stored === "REJECTED" && sheet.decidedAt
        ? { by: sheet.decidedBy ?? validatorName, at: capitalize(formatLongDateAt(sheet.decidedAt)), reason: sheet.rejectionReason ?? "" }
        : null,
    events: sheet.events
      .filter((ev) => ev.type in e.event)
      .map((ev) => ({
        id: ev.id,
        label: e.event[ev.type as keyof typeof e.event],
        by: ev.self ? e.byYou : t(e.by, { name: ev.actor }),
        at: formatDateTime(ev.at),
      })),
  };

  // Nouvelle semaine ou nouveau statut (après la soumission) : l'écran repart des données du serveur.
  return <WeekEntry key={`${week.year}-${week.week}-${view.status}`} view={view} />;
}
