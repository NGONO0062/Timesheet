"use server";
// Actions de l'administration de division (PROMPT.md §9.9, écran 12). Entrées validées
// avec zod puis par les règles pures ; portée et permission revérifiées par la couche
// de données.
import { refresh } from "next/cache";
import { z } from "zod";
import { checkRules, checkUser, checkWorkflow, type Matrix, type RulesErrors, type UserErrors, type WorkflowErrors } from "@/lib/admin/rules";
import { now } from "@/lib/clock";
import { AdminRuleError, changeRole, inviteUser, listManagers, resendInvitation, saveMatrix, saveRules, saveWorkflow, setActive, updateUser } from "@/lib/data/admin";
import { getViewer, scopeOf } from "@/lib/data/viewer";
import { dict } from "@/lib/i18n";
import { PERMISSIONS, type DivisionRole } from "@/lib/permissions";

const id = z.string().min(1).max(64);
const role = z.enum(["STAFF", "MANAGER", "OWNER", "DIVISION_ADMIN"]);
const user = z.object({
  email: z.string().max(254),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  role,
  managerId: id.nullable(),
});
const granted = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length);
const matrix = z.object({ STAFF: granted, MANAGER: granted, OWNER: granted, DIVISION_ADMIN: granted });
const workflow = z.object({
  ownerValidation: z.boolean(),
  hrAutoSend: z.boolean(),
  hrEmail: z.string().max(254),
  reminderAfterWorkingDays: z.number().int(),
  delegateToOwner: z.boolean(),
});
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

export type AdminError = AdminRuleError["code"] | "session" | "unknown";
type Fail = { ok: false; error: AdminError };

async function context() {
  const viewer = await getViewer();
  if (!viewer?.divisionId || !viewer.permissions.includes("ADMINISTER_DIVISION")) return null;
  return { scope: scopeOf(viewer), meta: { now: now(), actorLabel: `${viewer.firstName} ${viewer.lastName}` } };
}

function failure(e: unknown): Fail {
  if (e instanceof AdminRuleError) return { ok: false, error: e.code };
  console.error(e);
  return { ok: false, error: "unknown" };
}

const session: Fail = { ok: false, error: "session" };

/** Rôle changé sur la ligne, tout de suite ; renvoie l'ancien rôle pour « Annuler ». */
export async function setUserRole(userId: string, next: DivisionRole): Promise<{ ok: true; name: string; previous: DivisionRole } | Fail> {
  const ctx = await context();
  if (!ctx || !id.safeParse(userId).success || !role.safeParse(next).success) return session;
  try {
    const r = await changeRole(ctx.scope, userId, next, ctx.meta);
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    return failure(e);
  }
}

/** Activation ou désactivation, tout de suite ; « Annuler » rétablit l'état précédent. */
export async function setUserActive(userId: string, active: boolean): Promise<{ ok: true; name: string } | Fail> {
  const ctx = await context();
  if (!ctx || !id.safeParse(userId).success || typeof active !== "boolean") return session;
  try {
    const r = await setActive(ctx.scope, userId, active, ctx.meta);
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    return failure(e);
  }
}

export type UserFormResult = { ok: true; name: string; email?: string } | Fail | { ok: false; fields: UserErrors };

/** Modale d'invitation (`userId` null) ou de modification. */
export async function saveUserForm(userId: string | null, input: z.input<typeof user>): Promise<UserFormResult> {
  const ctx = await context();
  const parsed = user.safeParse(input);
  if (!ctx || !parsed.success || (userId !== null && !id.safeParse(userId).success)) return session;
  try {
    const managers = (await listManagers(ctx.scope)).map((m) => m.id);
    const fields = checkUser(userId ? { ...parsed.data, email: "x@exemple.com" } : parsed.data, managers);
    if (Object.keys(fields).length) return { ok: false, fields };
    const r = userId ? await updateUser(ctx.scope, userId, parsed.data, ctx.meta) : await inviteUser(ctx.scope, parsed.data, ctx.meta);
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof AdminRuleError && e.code === "emailTaken") return { ok: false, fields: { email: dict.admin.errors.emailTaken } };
    if (e instanceof AdminRuleError && e.code === "manager") return { ok: false, fields: { manager: dict.admin.errors.manager } };
    return failure(e);
  }
}

export async function resendUserInvitation(userId: string): Promise<{ ok: true; email: string } | Fail> {
  const ctx = await context();
  if (!ctx || !id.safeParse(userId).success) return session;
  try {
    const r = await resendInvitation(ctx.scope, userId, ctx.meta);
    return { ok: true, email: r.email };
  } catch (e) {
    return failure(e);
  }
}

export async function savePermissions(input: Matrix): Promise<{ ok: true } | Fail> {
  const ctx = await context();
  const parsed = matrix.safeParse(input);
  if (!ctx || !parsed.success) return session;
  try {
    await saveMatrix(ctx.scope, parsed.data, ctx.meta);
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function saveWorkflowForm(input: z.input<typeof workflow>): Promise<{ ok: true } | Fail | { ok: false; fields: WorkflowErrors }> {
  const ctx = await context();
  const parsed = workflow.safeParse(input);
  if (!ctx || !parsed.success) return session;
  const fields = checkWorkflow(parsed.data);
  if (Object.keys(fields).length) return { ok: false, fields };
  try {
    await saveWorkflow(ctx.scope, parsed.data, ctx.meta);
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function saveRulesForm(input: z.input<typeof rules>): Promise<{ ok: true } | Fail | { ok: false; fields: RulesErrors }> {
  const ctx = await context();
  const parsed = rules.safeParse(input);
  if (!ctx || !parsed.success) return session;
  const fields = checkRules(parsed.data);
  if (Object.keys(fields).length) return { ok: false, fields };
  try {
    await saveRules(ctx.scope, parsed.data, ctx.meta);
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
