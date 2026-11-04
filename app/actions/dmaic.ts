"use server";
// Actions du suivi DMAIC (PROMPT.md §9.4, lot 3). Entrées validées avec zod ; portée,
// rôle (gestion du projet ou sponsor) et règles revérifiés par la couche de données.
import { refresh } from "next/cache";
import { z } from "zod";
import { now } from "@/lib/clock";
import { decideTollgate, DmaicRuleError, requestTollgate, saveIndicator, setDeliverable, type DmaicRefusal } from "@/lib/data/dmaic";
import { ProjectRuleError } from "@/lib/data/projects";
import { getViewer, scopeOf } from "@/lib/data/viewer";
import { isDeliverableKey } from "@/lib/projects/deliverables";
import { checkIndicator, type IndicatorErrors } from "@/lib/projects/indicator";

const id = z.string().min(1).max(64);
const indicator = z.object({ name: z.string().max(200), unit: z.string().max(40), baseline: z.string().max(30), target: z.string().max(30), current: z.string().max(30) });

export type DmaicActionError = DmaicRefusal | "session" | "notFound" | "notDmaic" | "unknown";
type Failure = { ok: false; error: DmaicActionError };

async function context() {
  const viewer = await getViewer();
  if (!viewer?.divisionId || !viewer.permissions.includes("MANAGE_PROJECTS")) return null;
  return { scope: scopeOf(viewer), label: `${viewer.firstName} ${viewer.lastName}` };
}

function failure(e: unknown): Failure {
  if (e instanceof DmaicRuleError) return { ok: false, error: e.code };
  if (e instanceof ProjectRuleError && (e.code === "notFound" || e.code === "notDmaic")) return { ok: false, error: e.code };
  console.error(e);
  return { ok: false, error: "unknown" };
}

/** Coche ou décoche un livrable type ; immédiat, avec « Annuler » à l'écran. */
export async function toggleDeliverable(projectId: string, key: string, done: boolean): Promise<{ ok: true } | Failure> {
  const ctx = await context();
  if (!ctx || !id.safeParse(projectId).success || !isDeliverableKey(key) || typeof done !== "boolean") return { ok: false, error: "session" };
  try {
    await setDeliverable(ctx.scope, projectId, key, done, now());
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** Enregistre l'indicateur ; tous les champs vides le retirent. */
export async function saveProjectIndicator(projectId: string, input: z.input<typeof indicator>): Promise<{ ok: true; cleared: boolean } | Failure | { ok: false; fields: IndicatorErrors }> {
  const ctx = await context();
  const parsed = indicator.safeParse(input);
  if (!ctx || !parsed.success || !id.safeParse(projectId).success) return { ok: false, error: "session" };
  const checked = checkIndicator(parsed.data);
  if (!checked.ok) return { ok: false, fields: checked.errors };
  try {
    await saveIndicator(ctx.scope, projectId, checked.value, ctx.label);
    refresh();
    return { ok: true, cleared: checked.value === null };
  } catch (e) {
    return failure(e);
  }
}

/** Demande de revue de passage de la phase en cours, avec un message facultatif au sponsor. */
export async function askTollgate(projectId: string, note: string) {
  const ctx = await context();
  if (!ctx || !id.safeParse(projectId).success || !z.string().max(2000).safeParse(note).success) return { ok: false as const, error: "session" as const };
  try {
    const r = await requestTollgate(ctx.scope, projectId, note, now(), ctx.label);
    refresh();
    return { ok: true as const, phase: r.phase, sponsor: r.sponsor };
  } catch (e) {
    return failure(e);
  }
}

/** Décision du sponsor : passage accordé, ou compléments demandés (commentaire obligatoire). */
export async function decideProjectTollgate(projectId: string, decision: "APPROVE" | "CHANGES", comment: string) {
  const ctx = await context();
  if (!ctx || !id.safeParse(projectId).success || !z.enum(["APPROVE", "CHANGES"]).safeParse(decision).success || !z.string().max(2000).safeParse(comment).success) {
    return { ok: false as const, error: "session" as const };
  }
  try {
    const r = await decideTollgate(ctx.scope, projectId, decision, comment, now(), ctx.label);
    refresh();
    return { ok: true as const, ...r };
  } catch (e) {
    return failure(e);
  }
}
