// Réponses de l'API de saisie (EntryController), telles que reçues.
import type { TimesheetStatus } from "@/shared/lib/status";

export type WeekRef = { year: number; week: number };

export type WeekDay = { date: string; expected: number; holiday: string | null; isFuture: boolean; value: string | null; flagged: boolean };

export type Choice = { key: string; project: string; activity: string; code: string; closed: boolean };

export type HistoryEvent = { type: "SUBMITTED" | "REJECTED" | "VALIDATED"; by: string; byYou: boolean; at: string };

export type Week = {
  year: number;
  week: number;
  current: WeekRef;
  allowFutureWeeks: boolean;
  days: WeekDay[];
  choices: Choice[];
  status: TimesheetStatus;
  editable: boolean;
  comment: string | null;
  savedAt: string | null;
  deadline: string;
  submittedAt: string | null;
  submissionCount: number;
  validator: string | null;
  decision: { by: string; at: string; reason: string | null } | null;
  recent: Array<WeekRef & { status: TimesheetStatus }>;
  history: HistoryEvent[];
};

export type SaveResult = { savedAt: string | null; status: TimesheetStatus };

export type WeekSummary = { year: number; week: number; monday: string; filled: number; expected: number; status: TimesheetStatus; deadline: string };

export type Dashboard = {
  firstName: string;
  divisionName: string | null;
  managerName: string | null;
  isIntern: boolean;
  todo: Array<{ kind: "missing" | "rejected"; week: WeekSummary }>;
  current: { week: WeekSummary; days: Array<{ date: string; expected: number; isFuture: boolean; filled: boolean; flagged: boolean }> };
  projects: Array<{ code: string; name: string; status: "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "DONE"; start: string; end: string | null; activities: string[]; daysThisWeek: number; acceptsEntry: boolean }>;
  recent: WeekSummary[];
};

/** « 2026-03-16 » → date UTC du jour (les règles et formats travaillent en dates UTC). */
export function dayOf(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}
