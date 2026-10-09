import "server-only";
// Rappel de saisie du vendredi à 12:00 (PROMPT.md §9.11, préférence de l'écran 14) :
// chaque personne qui saisit ses temps et dont la semaine en cours est incomplète, non
// soumise, reçoit un e-mail avant l'échéance. Une fois par personne et par semaine.
// Appelé par le planificateur de l'hébergement (POST /api/taches/rappels-saisie).
import { formatDateAt, formatHours, formatRange } from "@/lib/format";
import { isoWeekOf, todayInDivision } from "@/lib/iso-week";
import { fillUpcomingMail } from "@/lib/mail/templates";
import { appUrl, sendMail } from "@/lib/mail/send";
import { wantsNotification } from "@/lib/notifications";
import { effectivePermissions, type DivisionRole, type Permission } from "@/lib/permissions";
import { entryHref } from "@/lib/routes";
import { appendAudit } from "./audit";
import { prisma } from "./db";
import { toEntrySettings, weekFrame } from "./timesheets";

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

/** Semaine incomplète : moins d'heures saisies qu'attendu, et pas encore soumise ni validée. */
export function needsFillReminder(status: string | null, done: number, expected: number): boolean {
  return (status === null || status === "DRAFT" || status === "REJECTED") && expected > 0 && done < expected;
}

/** `only` : limiter à certaines divisions (tests d'intégration) ; par défaut, toutes les divisions actives. */
export async function sendFillReminders(now: Date, only?: string[]): Promise<number> {
  const week = isoWeekOf(todayInDivision(now));
  const key = `${week.year}-S${week.week}`;
  const divisions = await prisma.division.findMany({
    where: { status: "ACTIVE", ...(only ? { id: { in: only } } : {}) },
    include: { settings: true, holidays: { select: { date: true } }, permissions: true },
  });
  let sent = 0;
  for (const division of divisions) {
    const frame = weekFrame(week, toEntrySettings(division.settings, division.holidays.map((h) => h.date)));
    // Échéance passée : la relance relève de la vue consolidée, pas de ce rappel.
    if (frame.deadline.getTime() <= now.getTime()) continue;
    const expected = frame.expected.reduce((a, b) => a + b, 0);
    const overrides = division.permissions.map((p) => ({ role: p.role as DivisionRole, permission: p.permission as Permission, granted: p.granted }));
    const people = await prisma.user.findMany({
      where: { divisionId: division.id, active: true, passwordHash: { not: null } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        notificationPrefs: true,
        timesheets: {
          where: { isoYear: week.year, isoWeek: week.week },
          select: { status: true, lines: { select: { entries: { select: { hours: true } } } } },
        },
      },
    });
    const already = new Set(
      (
        await prisma.auditLog.findMany({
          where: { divisionId: division.id, action: "FILL_REMINDER_SENT", actorId: null, metadata: { path: ["week"], equals: key } },
          select: { metadata: true },
        })
      ).map((r) => (r.metadata as { userId?: string }).userId),
    );
    for (const p of people) {
      if (already.has(p.id)) continue;
      if (!effectivePermissions(p.role, overrides).has("ENTER_TIME")) continue;
      if (!wantsNotification(p.notificationPrefs, "fillReminder")) continue;
      const sheet = p.timesheets[0];
      const done = (sheet?.lines ?? []).flatMap((l) => l.entries).reduce((a, e) => a + Number(e.hours), 0);
      if (!needsFillReminder(sheet?.status ?? null, done, expected)) continue;
      const ok = await sendMail(
        fillUpcomingMail({
          to: p.email,
          firstName: p.firstName,
          week: week.week,
          range: formatRange(frame.days[0]!, frame.days.at(-1)!),
          done: formatHours(done),
          expected: formatHours(expected),
          deadline: formatDateAt(frame.deadline),
          url: appUrl(entryHref(week)),
        }),
      );
      await appendAudit({
        actorLabel: "TimeSheet",
        divisionId: division.id,
        action: "FILL_REMINDER_SENT",
        objectLabel: `Semaine ${week.week} · ${fullName(p)}`,
        result: ok ? "SUCCESS" : "FAILURE",
        metadata: { week: key, userId: p.id, automatic: true },
      });
      if (ok) sent++;
    }
  }
  return sent;
}
