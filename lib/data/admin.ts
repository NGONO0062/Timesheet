import "server-only";
// Administration de division (PROMPT.md §9.9) : utilisateurs, rôles et permissions,
// workflow, règles de saisie. Tout exige ADMINISTER_DIVISION et reste dans la division.
import type { Prisma, Weekday } from "@prisma/client";
import { matrixOf, overridesFor, pageOf, type Matrix, type RulesInput, type UserInput, type WorkflowInput, parseNumber } from "@/lib/admin/rules";
import { dict, t } from "@/lib/i18n";
import { invitationMail } from "@/lib/mail/templates";
import { appUrl, sendMail } from "@/lib/mail/send";
import { DIVISION_ROLES, type DivisionRole, type Permission } from "@/lib/permissions";
import { appendAudit } from "./audit";
import { assertPermission, prisma, type DivisionScope } from "./db";
import { issueToken } from "./tokens";

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

export class AdminRuleError extends Error {
  constructor(public readonly code: "notFound" | "emailTaken" | "self" | "lastAdmin" | "manager") {
    super(code);
  }
}

function admin(scope: DivisionScope) {
  assertPermission(scope, "ADMINISTER_DIVISION");
}

type Meta = { now: Date; actorLabel: string };

async function audit(scope: DivisionScope, meta: Meta, action: Parameters<typeof appendAudit>[0]["action"], objectLabel: string, metadata: Prisma.InputJsonObject = {}) {
  await appendAudit({ actorId: scope.userId, actorLabel: meta.actorLabel, divisionId: scope.divisionId, action, objectLabel, result: "SUCCESS", metadata });
}

// ---------------------------------------------------------------------------
// Utilisateurs
// ---------------------------------------------------------------------------

/** Personnes à qui l'on peut rattacher quelqu'un : managers et owners actifs de la division. */
export async function listManagers(scope: DivisionScope) {
  admin(scope);
  const rows = await prisma.user.findMany({
    where: { divisionId: scope.divisionId, active: true, role: { in: ["MANAGER", "OWNER"] } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return rows.map((u) => ({ id: u.id, name: fullName(u) }));
}

export async function listUsersPage(scope: DivisionScope, query: string, requestedPage: number) {
  admin(scope);
  const q = query.trim();
  const where: Prisma.UserWhereInput = {
    divisionId: scope.divisionId,
    ...(q
      ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : {}),
  };
  const total = await prisma.user.count({ where });
  const p = pageOf(total, requestedPage);
  const rows = await prisma.user.findMany({
    where,
    // Ordre de la maquette 12 : owner, managers, puis les autres ; désactivés en fin de liste.
    orderBy: [{ active: "desc" }, { role: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    skip: p.skip,
    take: p.to - p.from + 1 || 0,
    include: { manager: { select: { firstName: true, lastName: true } }, internship: true, passwordTokens: { where: { kind: "INVITATION", usedAt: null }, select: { id: true }, take: 1 } },
  });
  return {
    ...p,
    total,
    rows: rows.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      name: fullName(u),
      email: u.email,
      role: u.role as DivisionRole,
      managerId: u.managerId,
      manager: u.manager ? fullName(u.manager) : null,
      active: u.active,
      invited: !u.passwordHash && u.passwordTokens.length > 0,
      isSelf: u.id === scope.userId,
    })),
  };
}

async function adminsLeft(scope: DivisionScope, exceptId: string) {
  return prisma.user.count({ where: { divisionId: scope.divisionId, role: "DIVISION_ADMIN", active: true, id: { not: exceptId } } });
}

async function target(scope: DivisionScope, id: string) {
  const user = await prisma.user.findFirst({ where: { id, divisionId: scope.divisionId } });
  if (!user) throw new AdminRuleError("notFound");
  return user;
}

/** Rôle changé sur la ligne ; le dernier admin de division ne peut pas perdre son rôle. */
export async function changeRole(scope: DivisionScope, id: string, role: DivisionRole, meta: Meta) {
  admin(scope);
  if (!DIVISION_ROLES.includes(role)) throw new AdminRuleError("notFound");
  const user = await target(scope, id);
  if (user.id === scope.userId) throw new AdminRuleError("self");
  if (user.role === "DIVISION_ADMIN" && role !== "DIVISION_ADMIN" && (await adminsLeft(scope, id)) === 0) throw new AdminRuleError("lastAdmin");
  await prisma.user.update({ where: { id }, data: { role } });
  await audit(scope, meta, "USER_ROLE_CHANGED", `${fullName(user)} · ${user.email}`, { from: user.role, to: role });
  return { name: fullName(user), previous: user.role as DivisionRole };
}

/** Activation ou désactivation : un compte désactivé ne se connecte plus, ses données restent. */
export async function setActive(scope: DivisionScope, id: string, active: boolean, meta: Meta) {
  admin(scope);
  const user = await target(scope, id);
  if (user.id === scope.userId) throw new AdminRuleError("self");
  if (!active && user.role === "DIVISION_ADMIN" && (await adminsLeft(scope, id)) === 0) throw new AdminRuleError("lastAdmin");
  await prisma.user.update({ where: { id }, data: { active } });
  await audit(scope, meta, active ? "USER_ACTIVATED" : "USER_DEACTIVATED", `${fullName(user)} · ${user.email}`);
  return { name: fullName(user) };
}

/** Manager valide de la division ; renvoie l'équipe qu'il anime, à laquelle la personne est rattachée. */
async function checkManager(scope: DivisionScope, managerId: string | null, selfId?: string): Promise<string | null> {
  if (!managerId) return null;
  if (managerId === selfId) throw new AdminRuleError("manager");
  const manager = await prisma.user.findFirst({
    where: { id: managerId, divisionId: scope.divisionId, active: true, role: { in: ["MANAGER", "OWNER"] } },
    select: { managedTeams: { where: { divisionId: scope.divisionId }, select: { id: true }, take: 1 } },
  });
  if (!manager) throw new AdminRuleError("manager");
  return manager.managedTeams[0]?.id ?? null;
}

/** Modification depuis la modale : nom, rôle, rattachement. L'adresse ne change pas. */
export async function updateUser(scope: DivisionScope, id: string, input: Omit<UserInput, "email">, meta: Meta) {
  admin(scope);
  const user = await target(scope, id);
  const teamId = await checkManager(scope, input.managerId, id);
  if (input.role !== user.role) {
    if (user.id === scope.userId) throw new AdminRuleError("self");
    if (user.role === "DIVISION_ADMIN" && (await adminsLeft(scope, id)) === 0) throw new AdminRuleError("lastAdmin");
  }
  const updated = await prisma.user.update({
    where: { id },
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: input.role,
      managerId: input.managerId,
      // Le manager change : la personne rejoint son équipe. Sinon, l'équipe reste.
      ...(input.managerId !== user.managerId ? { teamId } : {}),
    },
  });
  await audit(scope, meta, "USER_UPDATED", `${fullName(updated)} · ${updated.email}`, { role: input.role, managerId: input.managerId });
  return { name: fullName(updated) };
}

/** Invitation : compte sans mot de passe, lien d'une semaine pour le choisir (PROMPT.md §19). */
export async function inviteUser(scope: DivisionScope, input: UserInput, meta: Meta) {
  admin(scope);
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new AdminRuleError("emailTaken");
  const teamId = await checkManager(scope, input.managerId);
  const user = await prisma.user.create({
    data: { divisionId: scope.divisionId, email, firstName: input.firstName.trim(), lastName: input.lastName.trim(), role: input.role, managerId: input.managerId, teamId, passwordHash: null },
  });
  const division = await prisma.division.findUniqueOrThrow({ where: { id: scope.divisionId }, select: { name: true } });
  const token = await issueToken(user.id, "INVITATION", meta.now);
  await sendMail(invitationMail({ to: email, firstName: user.firstName, division: division.name, inviter: meta.actorLabel, url: appUrl(`/invitation/${token}`) }));
  await audit(scope, meta, "USER_INVITED", `${fullName(user)} · ${email}`, { role: input.role });
  return { name: fullName(user), email };
}

/** Nouvel envoi de l'invitation d'un compte qui n'a pas encore choisi son mot de passe. */
export async function resendInvitation(scope: DivisionScope, id: string, meta: Meta) {
  admin(scope);
  const user = await target(scope, id);
  if (user.passwordHash || !user.active) throw new AdminRuleError("notFound");
  const division = await prisma.division.findUniqueOrThrow({ where: { id: scope.divisionId }, select: { name: true } });
  const token = await issueToken(user.id, "INVITATION", meta.now);
  await sendMail(invitationMail({ to: user.email, firstName: user.firstName, division: division.name, inviter: meta.actorLabel, url: appUrl(`/invitation/${token}`) }));
  await audit(scope, meta, "USER_INVITED", `${fullName(user)} · ${user.email}`, { resent: true });
  return { name: fullName(user), email: user.email };
}

// ---------------------------------------------------------------------------
// Rôles et permissions
// ---------------------------------------------------------------------------

export async function getMatrix(scope: DivisionScope): Promise<Matrix> {
  admin(scope);
  const rows = await prisma.rolePermission.findMany({ where: { divisionId: scope.divisionId } });
  return matrixOf(rows.map((r) => ({ role: r.role as DivisionRole, permission: r.permission as Permission, granted: r.granted })));
}

export async function saveMatrix(scope: DivisionScope, matrix: Matrix, meta: Meta) {
  admin(scope);
  const overrides = overridesFor(matrix);
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { divisionId: scope.divisionId } }),
    prisma.rolePermission.createMany({ data: overrides.map((o) => ({ divisionId: scope.divisionId, role: o.role, permission: o.permission, granted: o.granted })) }),
  ]);
  await audit(scope, meta, "PERMISSIONS_CHANGED", dict.admin.permissionsTitle, { overrides: overrides.map((o) => `${o.role}:${o.permission}:${o.granted ? "+" : "-"}`) });
}

// ---------------------------------------------------------------------------
// Workflow et règles de saisie
// ---------------------------------------------------------------------------

export async function getDivisionSettings(scope: DivisionScope) {
  admin(scope);
  const division = await prisma.division.findUniqueOrThrow({ where: { id: scope.divisionId }, include: { settings: true } });
  const s = division.settings ?? (await prisma.divisionSettings.create({ data: { divisionId: scope.divisionId } }));
  return {
    name: division.name,
    workflow: { ownerValidation: s.ownerValidation, hrAutoSend: s.hrAutoSend, hrEmail: s.hrEmail ?? "", reminderAfterWorkingDays: s.reminderAfterWorkingDays, delegateToOwner: s.delegateToOwner },
    rules: {
      unit: s.unit,
      workingDays: [...s.workingDays] as string[],
      hoursPerDay: String(Number(s.hoursPerDay)).replace(".", ","),
      step: Number(s.step),
      deadlineDay: s.deadlineDay as string,
      deadlineTime: s.deadlineTime,
      fillAlertThreshold: String(s.fillAlertThreshold),
      allowFutureWeeks: s.allowFutureWeeks,
      lockAfterValidation: s.lockAfterValidation,
    } satisfies RulesInput,
  };
}

export async function saveWorkflow(scope: DivisionScope, w: WorkflowInput, meta: Meta) {
  admin(scope);
  const data = { ownerValidation: w.ownerValidation, hrAutoSend: w.hrAutoSend, hrEmail: w.hrEmail.trim().toLowerCase(), reminderAfterWorkingDays: w.reminderAfterWorkingDays, delegateToOwner: w.delegateToOwner };
  await prisma.divisionSettings.upsert({ where: { divisionId: scope.divisionId }, update: data, create: { divisionId: scope.divisionId, ...data } });
  await audit(scope, meta, "WORKFLOW_CHANGED", dict.admin.workflowTitle, data);
}

export async function saveRules(scope: DivisionScope, r: RulesInput, meta: Meta) {
  admin(scope);
  const data = {
    unit: r.unit,
    workingDays: r.workingDays as Weekday[],
    hoursPerDay: parseNumber(r.hoursPerDay)!,
    step: r.step,
    deadlineDay: r.deadlineDay as "FRIDAY" | "MONDAY",
    deadlineTime: r.deadlineTime.trim(),
    fillAlertThreshold: parseNumber(r.fillAlertThreshold)!,
    allowFutureWeeks: r.allowFutureWeeks,
    lockAfterValidation: r.lockAfterValidation,
  };
  await prisma.divisionSettings.upsert({ where: { divisionId: scope.divisionId }, update: data, create: { divisionId: scope.divisionId, ...data } });
  await audit(scope, meta, "RULES_CHANGED", dict.admin.rulesTitle, { ...data, hoursPerDay: data.hoursPerDay, step: data.step });
}

export const userLabel = (name: string, email: string) => t(dict.admin.userLabel, { name, email });
