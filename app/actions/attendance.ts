"use server";
// Actions de la fiche de présence (PROMPT.md §9.7, §9.8). Entrées validées avec zod ;
// portée, circuit et mot de passe revérifiés par la couche de données.
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { now } from "@/lib/clock";
import { AttendanceRuleError, rejectAsSupervisor, sendToHr, signAsIntern, signAsSupervisor } from "@/lib/data/attendance";
import { getViewer, scopeOf } from "@/lib/data/viewer";

const id = z.string().min(1).max(64);
const signature = z.object({
  method: z.enum(["DRAWN", "PASSWORD"]),
  drawing: z.string().max(20_000).optional(),
  password: z.string().max(200).optional(),
  observation: z.string().max(500).optional(),
});

export type AttendanceError = AttendanceRuleError["code"] | "session" | "unknown";
export type AttendanceResult<T = object> = ({ ok: true } & T) | { ok: false; error: AttendanceError };

async function context(permission: "ENTER_TIME" | "VALIDATE_TEAM") {
  const viewer = await getViewer();
  if (!viewer?.divisionId || !viewer.permissions.includes(permission)) return null;
  const h = await headers();
  return {
    scope: scopeOf(viewer),
    meta: {
      now: now(),
      actorLabel: `${viewer.firstName} ${viewer.lastName}`,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    },
  };
}

function failure(e: unknown): { ok: false; error: AttendanceError } {
  if (e instanceof AttendanceRuleError) return { ok: false, error: e.code };
  console.error(e);
  return { ok: false, error: "unknown" };
}

/** Signature du stagiaire. */
export async function signMySheet(sheetId: string, input: z.input<typeof signature>): Promise<AttendanceResult<{ supervisor: string }>> {
  const ctx = await context("ENTER_TIME");
  const parsed = signature.safeParse(input);
  if (!ctx || !parsed.success || !id.safeParse(sheetId).success) return { ok: false, error: "session" };
  try {
    const r = await signAsIntern(ctx.scope, sheetId, parsed.data, ctx.meta);
    refresh();
    return { ok: true, supervisor: r.supervisor };
  } catch (e) {
    return failure(e);
  }
}

/** Signature du superviseur ; l'envoi aux RH suit si le réglage est actif. */
export async function countersignSheet(sheetId: string, input: z.input<typeof signature>): Promise<AttendanceResult<{ sent: string | null; sendError?: boolean }>> {
  const ctx = await context("VALIDATE_TEAM");
  const parsed = signature.safeParse(input);
  if (!ctx || !parsed.success || !id.safeParse(sheetId).success) return { ok: false, error: "session" };
  try {
    const r = await signAsSupervisor(ctx.scope, sheetId, parsed.data, ctx.meta);
    refresh();
    return { ok: true, sent: r.sent };
  } catch (e) {
    // La signature est posée, seul l'envoi a échoué : on le dit sans annuler.
    if (e instanceof AttendanceRuleError && (e.code === "sendFailed" || e.code === "hrEmail")) {
      refresh();
      return { ok: true, sent: null, sendError: true };
    }
    return failure(e);
  }
}

/**
 * Renvoi au stagiaire, avec motif. La fiche repasse « À signer » et sort de la portée
 * du détail superviseur : retour à la file, qui affiche la confirmation.
 */
export async function returnSheet(sheetId: string, reason: string): Promise<{ ok: false; error: AttendanceError }> {
  const ctx = await context("VALIDATE_TEAM");
  if (!ctx || !id.safeParse(sheetId).success || !z.string().max(500).safeParse(reason).success) return { ok: false, error: "session" };
  try {
    await rejectAsSupervisor(ctx.scope, sheetId, reason, ctx.meta);
  } catch (e) {
    return failure(e);
  }
  redirect(`/validation/presence?renvoyee=${sheetId}`);
}

/** Envoi aux RH à la main. */
export async function sendSheetToHr(sheetId: string): Promise<AttendanceResult<{ to: string }>> {
  const ctx = await context("VALIDATE_TEAM");
  if (!ctx || !id.safeParse(sheetId).success) return { ok: false, error: "session" };
  try {
    const to = await sendToHr(ctx.scope, sheetId, ctx.meta);
    refresh();
    return { ok: true, to };
  } catch (e) {
    return failure(e);
  }
}
