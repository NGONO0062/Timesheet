"use server";
// Actions de validation (PROMPT.md §9.3). Entrées validées avec zod ; portée et
// règles revérifiées par la couche de données.
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { now } from "@/lib/clock";
import { decide, listPendingIds, ValidationRuleError, type Decision } from "@/lib/data/validation";
import { getViewer, scopeOf } from "@/lib/data/viewer";

const ids = z.array(z.string().min(1).max(64)).min(1).max(200);
const reason = z.string().max(2000);

export type GroupResult = { ok: true; done: number; skipped: number } | { ok: false; error: "reasonMissing" | "session" | "unknown" };

async function context() {
  const viewer = await getViewer();
  if (!viewer?.divisionId || !viewer.permissions.includes("VALIDATE_TEAM")) return null;
  return { scope: scopeOf(viewer), label: `${viewer.firstName} ${viewer.lastName}` };
}

async function run(sheetIds: unknown, decision: Decision): Promise<GroupResult> {
  const ctx = await context();
  const parsed = ids.safeParse(sheetIds);
  if (!ctx || !parsed.success) return { ok: false, error: "session" };
  try {
    const r = await decide(ctx.scope, parsed.data, decision, now(), ctx.label);
    refresh();
    return { ok: true, done: r.done, skipped: r.skipped };
  } catch (e) {
    if (e instanceof ValidationRuleError && e.code === "reasonMissing") return { ok: false, error: "reasonMissing" };
    console.error(e);
    return { ok: false, error: "unknown" };
  }
}

/** Validation groupée : directe, sans fenêtre de confirmation. */
export async function validateSheets(sheetIds: string[]): Promise<GroupResult> {
  return run(sheetIds, { kind: "VALIDATE" });
}

/** Rejet groupé, avec un motif commun obligatoire (saisi dans une modale). */
export async function rejectSheets(sheetIds: string[], motif: string): Promise<GroupResult> {
  const r = reason.safeParse(motif);
  if (!r.success) return { ok: false, error: "reasonMissing" };
  return run(sheetIds, { kind: "REJECT", reason: r.data });
}

const single = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("VALIDATE") }),
  z.object({
    decision: z.literal("REJECT"),
    reason,
    flags: z.array(z.object({ lineId: z.string().min(1).max(64), day: z.number().int().min(0).max(6) })).max(100),
  }),
]);

export type DecideResult = { ok: false; error: "reasonMissing" | "alreadyDecided" | "session" | "unknown" };

/** Décision depuis le détail d'une fiche : on enchaîne sur la fiche en attente suivante. */
export async function decideSheet(sheetId: string, input: z.input<typeof single>): Promise<DecideResult> {
  const ctx = await context();
  const parsed = single.safeParse(input);
  if (!ctx || !parsed.success || !sheetId) return { ok: false, error: "session" };
  const before = await listPendingIds(ctx.scope);
  const decision: Decision = parsed.data.decision === "VALIDATE" ? { kind: "VALIDATE" } : { kind: "REJECT", reason: parsed.data.reason, flags: parsed.data.flags };
  let done = 0;
  try {
    done = (await decide(ctx.scope, [sheetId], decision, now(), ctx.label)).done;
  } catch (e) {
    if (e instanceof ValidationRuleError && e.code === "reasonMissing") return { ok: false, error: "reasonMissing" };
    console.error(e);
    return { ok: false, error: "unknown" };
  }
  if (done === 0) return { ok: false, error: "alreadyDecided" };
  const fait = decision.kind === "VALIDATE" ? "validee" : "rejetee";
  const position = before.indexOf(sheetId);
  const next = before.slice(position + 1).find((id) => id !== sheetId) ?? before.find((id) => id !== sheetId);
  redirect(next ? `/validation/${next}?fait=${fait}` : `/validation?fait=${fait}`);
}
