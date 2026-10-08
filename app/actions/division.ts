"use server";
// Actions de la vue consolidée (PROMPT.md §9.6) : relances par e-mail. Entrées
// validées avec zod ; portée et règles revérifiées par la couche de données.
import { z } from "zod";
import { now } from "@/lib/clock";
import { DivisionRuleError, remindManager, remindPerson } from "@/lib/data/division";
import { getViewer, scopeOf } from "@/lib/data/viewer";
import { isValidIsoWeek } from "@/lib/iso-week";

const id = z.string().min(1).max(64);
const week = z.object({ year: z.number().int(), week: z.number().int() }).refine(isValidIsoWeek);

export type RemindResult = { ok: true; name: string } | { ok: false; error: "session" | "nothingLate" | "failed" };

async function context() {
  const viewer = await getViewer();
  if (!viewer?.divisionId || !viewer.permissions.includes("VIEW_DIVISION")) return null;
  return { scope: scopeOf(viewer), label: `${viewer.firstName} ${viewer.lastName}` };
}

async function attempt(run: () => Promise<{ name: string }>): Promise<RemindResult> {
  try {
    const r = await run();
    return { ok: true, name: r.name };
  } catch (e) {
    if (e instanceof DivisionRuleError && e.code === "nothingLate") return { ok: false, error: "nothingLate" };
    if (!(e instanceof DivisionRuleError)) console.error(e);
    return { ok: false, error: "failed" };
  }
}

/** « Relancer le manager » : fiches de son équipe en attente depuis plus de N jours ouvrés. */
export async function remindManagerAction(managerId: string): Promise<RemindResult> {
  const ctx = await context();
  const parsed = id.safeParse(managerId);
  if (!ctx || !parsed.success) return { ok: false, error: "session" };
  return attempt(() => remindManager(ctx.scope, parsed.data, now(), ctx.label));
}

/** « Relancer » : rappel de saisie d'une semaine dont l'échéance est passée. */
export async function remindPersonAction(personId: string, target: { year: number; week: number }): Promise<RemindResult> {
  const ctx = await context();
  const p = id.safeParse(personId);
  const w = week.safeParse(target);
  if (!ctx || !p.success || !w.success) return { ok: false, error: "session" };
  return attempt(() => remindPerson(ctx.scope, p.data, w.data, now(), ctx.label));
}
