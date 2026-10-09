"use server";
// Actions de l'administration plateforme (PROMPT.md §9.10, écran 13) : état d'une
// division et onboarding en cinq étapes. Chaque étape enregistre sa saisie puis passe à
// la suivante (« Continuer ») ou revient à la liste (« Enregistrer et quitter »).
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkRules, checkWorkflow, type RulesErrors, type WorkflowErrors } from "@/lib/admin/rules";
import { now } from "@/lib/clock";
import { finishOnboarding, PlatformRuleError, saveAdmin, saveIdentity, saveOnboardingRules, saveRolesAndWorkflow, setDivisionStatus } from "@/lib/data/platform";
import { getViewer } from "@/lib/data/viewer";
import { dict, t } from "@/lib/i18n";
import { checkAdmin, checkIdentity, type AdminErrors, type IdentityErrors } from "@/lib/onboarding/rules";
import { PERMISSIONS } from "@/lib/permissions";

const id = z.string().regex(/^[a-z0-9]{1,64}$/i);
const intent = z.enum(["next", "quit"]);
const identity = z.object({ name: z.string().max(100), slug: z.string().max(60), direction: z.string().max(100) });
const adminInput = z.object({ fullName: z.string().max(200), email: z.string().max(254), config: z.enum(["COPY", "BLANK"]) });
const granted = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length);
const matrix = z.object({ STAFF: granted, MANAGER: granted, OWNER: granted, DIVISION_ADMIN: granted });
const workflow = z.object({ ownerValidation: z.boolean(), hrAutoSend: z.boolean(), hrEmail: z.string().max(254), reminderAfterWorkingDays: z.number().int(), delegateToOwner: z.boolean() });
const rules = z.object({
  unit: z.enum(["HOURS", "DAYS"]),
  workingDays: z.array(z.string().max(10)).max(7),
  hoursPerDay: z.string().max(10),
  step: z.number(),
  deadlineDay: z.string().max(10),
  deadlineTime: z.string().max(10),
  fillAlertThreshold: z.string().max(10),
  allowFutureWeeks: z.boolean(),
  lockAfterValidation: z.boolean(),
});

export type StepFailure = { ok: false; error: string };
type Fields<E> = { ok: false; fields: E };

async function context() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "PLATFORM_ADMIN") return null;
  return { scope: { userId: viewer.userId, role: viewer.role }, meta: { now: now(), actorLabel: `${viewer.firstName} ${viewer.lastName}` } };
}

const o = dict.onboarding.errors;
const session: StepFailure = { ok: false, error: o.session };

function failure(e: unknown): StepFailure {
  if (e instanceof PlatformRuleError) {
    if (e.code === "incomplete") return { ok: false, error: t(o.incomplete, { n: e.step ?? 1 }) };
    if (e.code === "notFound" || e.code === "onboarding") return { ok: false, error: o.notFound };
  }
  console.error(e);
  return { ok: false, error: o.unknown };
}

/** Après l'enregistrement d'une étape : la suivante, ou la liste avec le message. */
function go(divisionId: string, step: number, how: z.infer<typeof intent>): never {
  redirect(how === "quit" ? `/plateforme?enregistree=${divisionId}` : `/plateforme/divisions/nouvelle?division=${divisionId}&etape=${step}`);
}

export async function saveIdentityStep(divisionId: string | null, input: z.input<typeof identity>, how: z.input<typeof intent>): Promise<StepFailure | Fields<IdentityErrors>> {
  const ctx = await context();
  const parsed = identity.safeParse(input);
  if (!ctx || !parsed.success || !intent.safeParse(how).success || (divisionId !== null && !id.safeParse(divisionId).success)) return session;
  const fields = checkIdentity(parsed.data);
  if (Object.keys(fields).length) return { ok: false, fields };
  let r: { id: string; step: number };
  try {
    r = await saveIdentity(ctx.scope, divisionId, parsed.data, ctx.meta);
  } catch (e) {
    if (e instanceof PlatformRuleError && e.code === "slugTaken") return { ok: false, fields: { slug: o.slugTaken } };
    return failure(e);
  }
  go(r.id, 2, how);
}

export async function saveAdminStep(divisionId: string, input: z.input<typeof adminInput>, how: z.input<typeof intent>): Promise<StepFailure | Fields<AdminErrors>> {
  const ctx = await context();
  const parsed = adminInput.safeParse(input);
  if (!ctx || !parsed.success || !intent.safeParse(how).success || !id.safeParse(divisionId).success) return session;
  const fields = checkAdmin(parsed.data);
  if (Object.keys(fields).length) return { ok: false, fields };
  try {
    await saveAdmin(ctx.scope, divisionId, parsed.data, ctx.meta);
  } catch (e) {
    if (e instanceof PlatformRuleError && e.code === "emailTaken") return { ok: false, fields: { email: o.emailTaken } };
    return failure(e);
  }
  go(divisionId, 3, how);
}

export async function saveRolesStep(divisionId: string, m: z.input<typeof matrix>, w: z.input<typeof workflow>, how: z.input<typeof intent>): Promise<StepFailure | Fields<WorkflowErrors>> {
  const ctx = await context();
  const pm = matrix.safeParse(m);
  const pw = workflow.safeParse(w);
  if (!ctx || !pm.success || !pw.success || !intent.safeParse(how).success || !id.safeParse(divisionId).success) return session;
  const fields = checkWorkflow(pw.data);
  if (Object.keys(fields).length) return { ok: false, fields };
  try {
    await saveRolesAndWorkflow(ctx.scope, divisionId, pm.data, pw.data, ctx.meta);
  } catch (e) {
    return failure(e);
  }
  go(divisionId, 4, how);
}

export async function saveRulesStep(divisionId: string, r: z.input<typeof rules>, how: z.input<typeof intent>): Promise<StepFailure | Fields<RulesErrors>> {
  const ctx = await context();
  const parsed = rules.safeParse(r);
  if (!ctx || !parsed.success || !intent.safeParse(how).success || !id.safeParse(divisionId).success) return session;
  const fields = checkRules(parsed.data);
  if (Object.keys(fields).length) return { ok: false, fields };
  try {
    await saveOnboardingRules(ctx.scope, divisionId, parsed.data, ctx.meta);
  } catch (e) {
    return failure(e);
  }
  go(divisionId, 5, how);
}

/** Étape 5 : la division devient active, l'invitation part ; retour à la liste. */
export async function finishOnboardingStep(divisionId: string): Promise<StepFailure> {
  const ctx = await context();
  if (!ctx || !id.safeParse(divisionId).success) return session;
  try {
    await finishOnboarding(ctx.scope, divisionId, ctx.meta);
  } catch (e) {
    return failure(e);
  }
  redirect(`/plateforme?creee=${divisionId}`);
}

/** Suspension ou réactivation, tout de suite ; renvoie l'ancien état pour « Annuler ». */
export async function setDivisionState(divisionId: string, status: "ACTIVE" | "SUSPENDED"): Promise<{ ok: true; name: string; previous: "ACTIVE" | "SUSPENDED" } | StepFailure> {
  const ctx = await context();
  if (!ctx || !id.safeParse(divisionId).success || (status !== "ACTIVE" && status !== "SUSPENDED")) return session;
  try {
    const r = await setDivisionStatus(ctx.scope, divisionId, status, ctx.meta);
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof PlatformRuleError && e.code === "onboarding") return { ok: false, error: dict.platform.errors.onboarding };
    return failure(e);
  }
}
