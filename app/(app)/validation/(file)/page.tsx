// Écran 7 : file de validation (PROMPT.md §9.3, planche 07-File-validation).
import type { Metadata } from "next";
import { now } from "@/lib/clock";
import { countSheetsToCountersign } from "@/lib/data/attendance";
import { currentWeek } from "@/lib/data/timesheets";
import { listQueue, listReviewablePeople } from "@/lib/data/validation";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { formatDayMonth, formatHoursOf, formatRange, formatTime, zonedDay } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { addDays, mondayOf } from "@/lib/iso-week";
import { parseTab, periodOptions, submissionTag } from "@/lib/validation/queue";
import { ValidationQueue, type QueueView } from "./ValidationQueue";

export const metadata: Metadata = { title: dict.validation.title };

type Props = { searchParams: Promise<{ personne?: string; periode?: string; statut?: string; fait?: string }> };

export default async function Page({ searchParams }: Props) {
  const viewer = await requirePermission("VALIDATE_TEAM");
  const scope = scopeOf(viewer);
  const sp = await searchParams;
  const periods = periodOptions(currentWeek(now()));
  const period = periods.find((p) => p.key === sp.periode) ?? periods[0]!;
  const people = await listReviewablePeople(scope);
  const person = people.find((p) => p.id === sp.personne) ?? null;
  const tab = parseTab(sp.statut);
  const [{ rows, counts }, presenceCount] = await Promise.all([
    listQueue(scope, { personId: person?.id ?? null, weeks: period.weeks }, tab),
    countSheetsToCountersign(scope),
  ]);

  const view: QueueView = {
    people,
    personId: person?.id ?? "",
    periods: periods.map((p) => ({ key: p.key, label: p.label })),
    periodKey: period.key,
    defaultPeriodKey: periods[0]!.key,
    tab,
    counts,
    notice: sp.fait === "validee" ? dict.validation.doneValidated : sp.fait === "rejetee" ? dict.validation.doneRejected : null,
    presenceCount,
    rows: rows.map((r) => {
      const monday = mondayOf(r.week);
      return {
        id: r.id,
        name: r.name,
        week: t(dict.validation.weekShort, { week: r.week.week, range: formatRange(monday, addDays(monday, 4), false) }),
        hours: formatHoursOf(r.hours, r.expected),
        projects: r.projects,
        submitted: r.submittedAt ? `${formatDayMonth(zonedDay(r.submittedAt))}, ${formatTime(r.submittedAt)}` : "",
        status: r.status,
        tag: submissionTag(r.submissionCount),
      };
    }),
  };
  return <ValidationQueue view={view} />;
}
