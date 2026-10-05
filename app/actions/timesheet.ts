"use server";
// Actions de la saisie hebdomadaire (PROMPT.md §9.2). Entrées validées avec zod ;
// droits et règles revérifiés par la couche de données.
import { redirect } from "next/navigation";
import { z } from "zod";
import { now } from "@/lib/clock";
import { getViewer, scopeOf } from "@/lib/data/viewer";
import { saveDraft, submitWeek, TimesheetRuleError, type TimesheetError } from "@/lib/data/timesheets";
import { isValidIsoWeek } from "@/lib/iso-week";

const id = z.string().min(1).max(64);
const draft = z.object({
  year: z.number().int().min(2000).max(2100),
  week: z.number().int().min(1).max(53),
  comment: z.string().max(2000),
  lines: z.array(z.object({ projectId: id, activityId: id, hours: z.array(z.number().finite().nullable()).max(7) })).max(60),
});

export type DraftPayload = z.infer<typeof draft>;
export type EntryActionError = TimesheetError | "session" | "unknown";
export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: EntryActionError };

async function context(payload: unknown) {
  const viewer = await getViewer();
  if (!viewer?.divisionId || !viewer.permissions.includes("ENTER_TIME")) return { error: "session" as const };
  const parsed = draft.safeParse(payload);
  if (!parsed.success) return { error: "invalidHours" as const };
  const { year, week, comment, lines } = parsed.data;
  if (!isValidIsoWeek({ year, week })) return { error: "futureWeek" as const };
  return { viewer, scope: scopeOf(viewer), input: { week: { year, week }, comment, lines } };
}

function failure(e: unknown): { ok: false; error: EntryActionError } {
  if (e instanceof TimesheetRuleError) return { ok: false, error: e.code };
  console.error(e);
  return { ok: false, error: "unknown" };
}

/** Sauvegarde automatique du brouillon, environ une seconde après la dernière frappe. */
export async function saveWeekDraft(payload: DraftPayload): Promise<SaveResult> {
  const ctx = await context(payload);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "unknown" };
  try {
    const { savedAt } = await saveDraft(ctx.scope, ctx.input, now());
    return { ok: true, savedAt: savedAt.toISOString() };
  } catch (e) {
    return failure(e);
  }
}

/** Soumission confirmée dans la modale : la page revient en lecture seule. */
export async function submitWeekEntry(payload: DraftPayload): Promise<{ ok: false; error: EntryActionError }> {
  const ctx = await context(payload);
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "unknown" };
  try {
    await submitWeek(ctx.scope, ctx.input, now(), `${ctx.viewer.firstName} ${ctx.viewer.lastName}`);
  } catch (e) {
    return failure(e);
  }
  redirect(`/saisie/${ctx.input.week.year}/${ctx.input.week.week}?soumise=1`);
}
