// Réponses de l'API de validation (ValidationController), telles que reçues.
import type { Choice } from "@/entities/timesheet";
import type { TimesheetStatus } from "@/shared/lib/status";
import type { QueueTab } from "../lib/queue";

export type QueueFilters = { personId: string | null; period: string; tab: QueueTab };

export type QueueRow = {
  id: string;
  name: string;
  year: number;
  week: number;
  monday: string;
  status: TimesheetStatus;
  filled: number;
  expected: number;
  projects: number;
  submittedAt: string | null;
  submissionCount: number;
  hasComment: boolean;
  hasAbsence: boolean;
  unusualProject: boolean;
};

export type Queue = {
  current: { year: number; week: number };
  people: Array<{ id: string; name: string }>;
  counts: { submitted: number; validated: number; rejected: number; all: number };
  rows: QueueRow[];
};

export type ReviewEvent = { type: "CREATED" | "SUBMITTED" | "REJECTED" | "VALIDATED" | "REMINDER_SENT"; by: string; at: string };

export type Review = {
  id: string;
  name: string;
  role: "STAFF" | "MANAGER" | "OWNER" | "DIVISION_ADMIN" | "PLATFORM_ADMIN";
  year: number;
  week: number;
  status: TimesheetStatus;
  submittedAt: string | null;
  submissionCount: number;
  comment: string | null;
  days: Array<{ date: string; expected: number; value: string | null; flagged: boolean }>;
  choices: Choice[];
  history: ReviewEvent[];
  position: { index: number; count: number; previous: string | null; next: string | null } | null;
};

export type DecisionResult = { done: number; skipped: number; next: string | null };
