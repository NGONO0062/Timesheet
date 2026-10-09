import "server-only";
// Administration plateforme (PROMPT.md §9.10, écran 13) : divisions, onboarding, journal
// d'audit. Réservée à l'admin plateforme, qui gère les divisions et lit le journal, mais
// ne voit ni les fiches de temps ni les données métier d'une division.
import type { Prisma } from "@prisma/client";
import type { Matrix, RulesInput, WorkflowInput } from "@/lib/admin/rules";
import { AUDIT_CATEGORIES, type AuditAction } from "@/lib/audit/catalog";
import { AUDIT_PAGE_SIZE, type AuditFilters } from "@/lib/audit/filters";
import { dict, t } from "@/lib/i18n";
import { invitationMail } from "@/lib/mail/templates";
import { appUrl, sendMail } from "@/lib/mail/send";
import { PILOT_SLUG, splitName, type AdminInput, type IdentityInput } from "@/lib/onboarding/rules";
import type { Role } from "@/lib/permissions";
import { readMatrix, readSettings, writeMatrix, writeRules, writeWorkflow } from "./admin";
import { appendAudit } from "./audit";
import { AccessDenied, prisma } from "./db";
import { issueToken } from "./tokens";

/** Contexte exigé par chaque accès de la plateforme. */
export type PlatformScope = { userId: string; role: Role };
type Meta = { now: Date; actorLabel: string };

export class PlatformRuleError extends Error {
  constructor(public readonly code: "notFound" | "slugTaken" | "emailTaken" | "onboarding" | "incomplete", public readonly step?: number) {
    super(code);
  }
}

function platform(scope: PlatformScope) {
  if (scope.role !== "PLATFORM_ADMIN") throw new AccessDenied("réservé à l'admin plateforme");
}

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

async function audit(scope: PlatformScope, meta: Meta, divisionId: string, action: AuditAction, objectLabel: string, metadata: Prisma.InputJsonObject = {}) {
  await appendAudit({ actorId: scope.userId, actorLabel: meta.actorLabel, divisionId, action, objectLabel, result: "SUCCESS", metadata });
}

// ---------------------------------------------------------------------------
// Divisions
// ---------------------------------------------------------------------------

export async function listDivisions(scope: PlatformScope) {
  platform(scope);
  const rows = await prisma.division.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { users: true } },
      users: { where: { role: "DIVISION_ADMIN" }, select: { firstName: true, lastName: true, active: true, passwordHash: true }, orderBy: { createdAt: "asc" } },
    },
  });
  return rows.map((d) => {
    // Administrateur : le premier actif ; en onboarding, il n'est désigné qu'à la fin.
    const admin = d.status === "ONBOARDING" ? null : d.users.find((u) => u.active) ?? null;
    return {
      id: d.id,
      name: d.name,
      slug: d.slug,
      pilot: d.slug === PILOT_SLUG,
      admin: admin ? fullName(admin) : null,
      users: d._count.users,
      status: d.status,
      step: d.onboardingStep,
      createdAt: d.createdAt,
    };
  });
}

export async function getDivisionDetail(scope: PlatformScope, id: string) {
  platform(scope);
  const d = await prisma.division.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
      users: { where: { role: "DIVISION_ADMIN", active: true }, select: { firstName: true, lastName: true, email: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!d) return null;
  return {
    id: d.id,
    name: d.name,
    slug: d.slug,
    direction: d.direction,
    status: d.status,
    step: d.onboardingStep,
    createdAt: d.createdAt,
    users: d._count.users,
    admins: d.users.map((u) => `${fullName(u)} · ${u.email}`),
  };
}

/** Suspension ou réactivation, tout de suite ; renvoie l'ancien état pour « Annuler ». */
export async function setDivisionStatus(scope: PlatformScope, id: string, status: "ACTIVE" | "SUSPENDED", meta: Meta) {
  platform(scope);
  const d = await prisma.division.findUnique({ where: { id } });
  if (!d) throw new PlatformRuleError("notFound");
  if (d.status === "ONBOARDING") throw new PlatformRuleError("onboarding");
  await prisma.division.update({ where: { id }, data: { status } });
  if (d.status !== status) await audit(scope, meta, id, status === "SUSPENDED" ? "DIVISION_SUSPENDED" : "DIVISION_ACTIVATED", d.name);
  return { name: d.name, previous: d.status as "ACTIVE" | "SUSPENDED" };
}

// ---------------------------------------------------------------------------
// Onboarding en cinq étapes : la progression est enregistrée à chaque étape
// ---------------------------------------------------------------------------

async function onboardingDivision(id: string) {
  const d = await prisma.division.findUnique({ where: { id } });
  if (!d || d.status !== "ONBOARDING") throw new PlatformRuleError("notFound");
  return d;
}

/** Administrateur désigné à l'étape 2 : compte sans mot de passe, invité à la fin. */
async function pendingAdmin(divisionId: string) {
  return prisma.user.findFirst({ where: { divisionId, role: "DIVISION_ADMIN" }, orderBy: { createdAt: "asc" } });
}

async function advance(scope: PlatformScope, meta: Meta, d: { id: string; name: string; onboardingStep: number }, done: number) {
  const next = Math.min(5, Math.max(d.onboardingStep, done + 1));
  if (next !== d.onboardingStep) await prisma.division.update({ where: { id: d.id }, data: { onboardingStep: next } });
  await audit(scope, meta, d.id, "DIVISION_UPDATED", t(dict.onboarding.cardTitle, { n: done, title: dict.onboarding.steps[done - 1]! }) + ` · ${d.name}`);
  return next;
}

export async function getOnboarding(scope: PlatformScope, id: string) {
  platform(scope);
  const d = await onboardingDivision(id);
  const [admin, settings, matrix] = await Promise.all([pendingAdmin(id), readSettings(id), readMatrix(id)]);
  return {
    id: d.id,
    step: d.onboardingStep,
    identity: { name: d.name, slug: d.slug, direction: d.direction } satisfies IdentityInput,
    admin: admin ? { fullName: fullName(admin), email: admin.email, config: d.configSource ?? "COPY" } : null,
    config: d.configSource,
    workflow: settings.workflow,
    rules: settings.rules,
    matrix,
  };
}

/** Étape 1 : la division naît en onboarding ; identifiant unique. */
export async function saveIdentity(scope: PlatformScope, id: string | null, input: IdentityInput, meta: Meta) {
  platform(scope);
  const data = { name: input.name.trim(), slug: input.slug.trim(), direction: input.direction.trim() };
  const taken = await prisma.division.findUnique({ where: { slug: data.slug }, select: { id: true } });
  if (taken && taken.id !== id) throw new PlatformRuleError("slugTaken");
  if (id === null) {
    const d = await prisma.division.create({ data: { ...data, status: "ONBOARDING", onboardingStep: 2, createdAt: meta.now, settings: { create: {} } } });
    await audit(scope, meta, d.id, "DIVISION_UPDATED", t(dict.onboarding.cardTitle, { n: 1, title: dict.onboarding.steps[0]! }) + ` · ${d.name}`);
    return { id: d.id, step: 2 };
  }
  const d = await onboardingDivision(id);
  const updated = await prisma.division.update({ where: { id }, data });
  return { id, step: await advance(scope, meta, { ...d, name: updated.name }, 1) };
}

/** Configuration de départ : celle de la division pilote (rôles, workflow, règles, jamais les données), ou vierge. */
async function applyConfig(divisionId: string, config: "COPY" | "BLANK", scope: PlatformScope, meta: Meta) {
  const by = { actorId: scope.userId, ...meta };
  const pilot = config === "COPY" ? await prisma.division.findUnique({ where: { slug: PILOT_SLUG }, select: { id: true } }) : null;
  if (pilot) {
    const source = await readSettings(pilot.id);
    const current = await readSettings(divisionId);
    await writeMatrix(divisionId, await readMatrix(pilot.id), by);
    // L'adresse des RH est propre à la division : elle n'est pas reprise.
    await writeWorkflow(divisionId, { ...source.workflow, hrEmail: current.workflow.hrEmail }, by);
    await writeRules(divisionId, source.rules, by);
  } else {
    await prisma.rolePermission.deleteMany({ where: { divisionId } });
    await prisma.divisionSettings.deleteMany({ where: { divisionId } });
    await prisma.divisionSettings.create({ data: { divisionId } });
  }
  await prisma.division.update({ where: { id: divisionId }, data: { configSource: config } });
}

/** Étape 2 : administrateur (invité à la fin) et configuration de départ. */
export async function saveAdmin(scope: PlatformScope, id: string, input: AdminInput, meta: Meta) {
  platform(scope);
  const d = await onboardingDivision(id);
  const name = splitName(input.fullName)!;
  const email = input.email.trim().toLowerCase();
  const current = await pendingAdmin(id);
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (owner && owner.id !== current?.id) throw new PlatformRuleError("emailTaken");
  if (current) await prisma.user.update({ where: { id: current.id }, data: { ...name, email } });
  else await prisma.user.create({ data: { divisionId: id, role: "DIVISION_ADMIN", ...name, email, passwordHash: null } });
  if (d.configSource !== input.config) await applyConfig(id, input.config, scope, meta);
  return { step: await advance(scope, meta, d, 2) };
}

/** Étape 3 : rôles et permissions, workflow. */
export async function saveRolesAndWorkflow(scope: PlatformScope, id: string, matrix: Matrix, workflow: WorkflowInput, meta: Meta) {
  platform(scope);
  const d = await onboardingDivision(id);
  const by = { actorId: scope.userId, ...meta };
  await writeMatrix(id, matrix, by);
  await writeWorkflow(id, workflow, by);
  return { step: await advance(scope, meta, d, 3) };
}

/** Étape 4 : règles de saisie. */
export async function saveOnboardingRules(scope: PlatformScope, id: string, rules: RulesInput, meta: Meta) {
  platform(scope);
  const d = await onboardingDivision(id);
  await writeRules(id, rules, { actorId: scope.userId, ...meta });
  return { step: await advance(scope, meta, d, 4) };
}

/** Étape 5 : la division devient active et l'invitation de l'administrateur part. */
export async function finishOnboarding(scope: PlatformScope, id: string, meta: Meta) {
  platform(scope);
  const d = await onboardingDivision(id);
  const admin = await pendingAdmin(id);
  const settings = await readSettings(id);
  if (!admin) throw new PlatformRuleError("incomplete", 2);
  if (d.onboardingStep < 5) throw new PlatformRuleError("incomplete", d.onboardingStep);
  if (!settings.workflow.hrEmail) throw new PlatformRuleError("incomplete", 3);
  await prisma.division.update({ where: { id }, data: { status: "ACTIVE" } });
  const token = await issueToken(admin.id, "INVITATION", meta.now);
  await sendMail(invitationMail({ to: admin.email, firstName: admin.firstName, division: d.name, inviter: meta.actorLabel, url: appUrl(`/invitation/${token}`) }));
  await audit(scope, meta, id, "DIVISION_CREATED", d.name, { admin: admin.email });
  await audit(scope, meta, id, "USER_INVITED", `${fullName(admin)} · ${admin.email}`, { role: "DIVISION_ADMIN" });
  return { name: d.name, email: admin.email };
}

// ---------------------------------------------------------------------------
// Journal d'audit : lecture seule
// ---------------------------------------------------------------------------

export async function listDivisionOptions(scope: PlatformScope) {
  platform(scope);
  const rows = await prisma.division.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return rows;
}

function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  return {
    at: { gte: f.from, lt: f.to },
    ...(f.divisionId ? { divisionId: f.divisionId } : {}),
    ...(f.category ? { action: { in: [...AUDIT_CATEGORIES[f.category]] } } : {}),
    ...(f.q ? { OR: [{ actorLabel: { contains: f.q, mode: "insensitive" } }, { objectLabel: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
}

type AuditRow = { id: string; at: Date; actor: string | null; actorRole: Role | null; division: string | null; action: AuditAction; objectLabel: string; result: "SUCCESS" | "FAILURE" };

async function toRows(rows: Array<Prisma.AuditLogGetPayload<{ include: { division: { select: { name: true } } } }>>): Promise<AuditRow[]> {
  const ids = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)))];
  const users = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true } })).map((u) => [u.id, u.role as Role]));
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    // Échec de connexion : personne n'a prouvé son identité, l'acteur est « Compte non
    // identifié » ; l'adresse saisie reste dans l'objet (planche 13).
    actor: r.action === "LOGIN_FAILURE" ? null : r.actorLabel,
    actorRole: r.actorId && r.action !== "LOGIN_FAILURE" ? users.get(r.actorId) ?? null : null,
    division: r.division?.name ?? null,
    action: r.action as AuditAction,
    objectLabel: r.objectLabel,
    result: r.result,
  }));
}

export async function listAudit(scope: PlatformScope, f: AuditFilters) {
  platform(scope);
  const where = auditWhere(f);
  const total = await prisma.auditLog.count({ where });
  const count = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(f.page, count);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ at: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    include: { division: { select: { name: true } } },
  });
  return { rows: await toRows(rows), total, page, count, from: total ? (page - 1) * AUDIT_PAGE_SIZE + 1 : 0, to: Math.min(total, page * AUDIT_PAGE_SIZE) };
}

/** Export : toutes les lignes filtrées, dans la limite de 10 000. */
export async function exportAudit(scope: PlatformScope, f: AuditFilters) {
  platform(scope);
  const rows = await prisma.auditLog.findMany({ where: auditWhere(f), orderBy: [{ at: "desc" }, { id: "desc" }], take: 10_000, include: { division: { select: { name: true } } } });
  return toRows(rows);
}
