import "server-only";
// Suivi d'un projet DMAIC (PROMPT.md §9.4, lot 3) : revues de passage, livrables types,
// indicateur. Lecture : ceux qui gèrent le projet (portée de l'écran Projets) et son
// sponsor. Livrables, indicateur et demande de revue : ceux qui gèrent le projet.
// Décision de revue : le sponsor seul. Jamais une autre division.
import type { Prisma } from "@prisma/client";
import { deliverableProgress, type DeliverableKey } from "@/lib/projects/deliverables";
import { phaseLabel, type DmaicPhase } from "@/lib/projects/dmaic";
import type { Indicator } from "@/lib/projects/indicator";
import { checkDecision, latestTollgate, phaseAfterApproval, requestRefusal, type TollgateStatus } from "@/lib/projects/tollgate";
import { tollgateDecisionMail, tollgateRequestMail } from "@/lib/mail/templates";
import { appUrl, sendMail } from "@/lib/mail/send";
import { appendAudit } from "./audit";
import { assertPermission, prisma, type DivisionScope } from "./db";
import { managedProjectsWhere, ProjectRuleError } from "./projects";

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

export type DmaicRefusal = "notManaged" | "notSponsor" | "noSponsor" | "alreadyRequested" | "alreadyApproved" | "notRequested" | "archived" | "commentMissing";

export class DmaicRuleError extends Error {
  constructor(public readonly code: DmaicRefusal) {
    super(`Suivi DMAIC : ${code}`);
    this.name = "DmaicRuleError";
  }
}

/** Projets dont le contexte peut lire le suivi : ceux qu'il gère, et ceux dont il est sponsor. */
function followUpWhere(scope: DivisionScope): Prisma.ProjectWhereInput {
  assertPermission(scope, "MANAGE_PROJECTS");
  return { divisionId: scope.divisionId, isSystem: false, OR: [managedProjectsWhere(scope), { sponsorId: scope.userId }] };
}

async function isManaged(scope: DivisionScope, projectId: string, db: Prisma.TransactionClient = prisma) {
  return (await db.project.count({ where: { id: projectId, divisionId: scope.divisionId, ...managedProjectsWhere(scope) } })) > 0;
}

/** Le suivi existe pour ce contexte (contrôle du layout : vrai 404 sinon). */
export async function followUpExists(scope: DivisionScope, projectId: string): Promise<boolean> {
  return (await prisma.project.count({ where: { id: projectId, ...followUpWhere(scope) } })) > 0;
}

export type TollgateView = {
  id: string;
  phase: DmaicPhase;
  status: TollgateStatus;
  requestedAt: Date;
  requestedBy: string | null;
  requestedById: string | null;
  note: string | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  comment: string | null;
};

export type FollowUp = {
  id: string;
  code: string;
  name: string;
  kind: "STANDARD" | "DMAIC";
  phase: DmaicPhase | null;
  archived: boolean;
  sponsor: { id: string; name: string } | null;
  /** Le contexte gère le projet : livrables, indicateur, demande de revue. */
  canManage: boolean;
  /** Le contexte est le sponsor : décision de revue. */
  isSponsor: boolean;
  done: DeliverableKey[];
  indicator: Indicator | null;
  tollgates: TollgateView[];
};

const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

export async function getFollowUp(scope: DivisionScope, projectId: string): Promise<FollowUp | null> {
  const p = await prisma.project.findFirst({
    where: { id: projectId, ...followUpWhere(scope) },
    include: {
      sponsor: { select: { id: true, firstName: true, lastName: true } },
      deliverables: { select: { key: true } },
      tollgates: {
        orderBy: { requestedAt: "asc" },
        include: { requestedBy: { select: { firstName: true, lastName: true } }, decidedBy: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!p) return null;
  const baseline = num(p.kpiBaseline);
  const target = num(p.kpiTarget);
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    kind: p.kind,
    phase: p.phase,
    archived: p.archivedAt !== null,
    sponsor: p.sponsor ? { id: p.sponsor.id, name: fullName(p.sponsor) } : null,
    canManage: await isManaged(scope, p.id),
    isSponsor: p.sponsorId === scope.userId,
    done: p.deliverables.map((d) => d.key as DeliverableKey),
    indicator: p.kpiName && baseline !== null && target !== null ? { name: p.kpiName, unit: p.kpiUnit, baseline, target, current: num(p.kpiCurrent) } : null,
    tollgates: p.tollgates.map((g) => ({
      id: g.id,
      phase: g.phase,
      status: g.status,
      requestedAt: g.requestedAt,
      requestedBy: g.requestedBy ? fullName(g.requestedBy) : null,
      requestedById: g.requestedById,
      note: g.note,
      decidedAt: g.decidedAt,
      decidedBy: g.decidedBy ? fullName(g.decidedBy) : null,
      comment: g.comment,
    })),
  };
}

/** Projet DMAIC géré par le contexte, non archivé : préalable de toute modification du suivi. */
async function managedDmaic(scope: DivisionScope, projectId: string, db: Prisma.TransactionClient = prisma) {
  const p = await db.project.findFirst({ where: { id: projectId, ...followUpWhere(scope) } });
  if (!p) throw new ProjectRuleError("notFound");
  if (p.kind !== "DMAIC" || p.phase === null) throw new ProjectRuleError("notDmaic");
  if (p.archivedAt !== null) throw new DmaicRuleError("archived");
  if (!(await isManaged(scope, p.id, db))) throw new DmaicRuleError("notManaged");
  return { ...p, phase: p.phase };
}

/** Coche ou décoche un livrable type ; immédiat, réversible (« Annuler »). Pas de journal d'audit (volume). */
export async function setDeliverable(scope: DivisionScope, projectId: string, key: DeliverableKey, done: boolean, now: Date) {
  const p = await managedDmaic(scope, projectId);
  if (done) {
    await prisma.projectDeliverable.upsert({
      where: { projectId_key: { projectId: p.id, key } },
      update: {},
      create: { divisionId: scope.divisionId, projectId: p.id, key, doneAt: now, doneById: scope.userId },
    });
  } else {
    await prisma.projectDeliverable.deleteMany({ where: { projectId: p.id, key } });
  }
  return { name: p.name };
}

/** Enregistre (ou retire, avec null) l'indicateur du projet. */
export async function saveIndicator(scope: DivisionScope, projectId: string, indicator: Indicator | null, actorLabel: string) {
  const p = await managedDmaic(scope, projectId);
  await prisma.project.update({
    where: { id: p.id },
    data: {
      kpiName: indicator?.name ?? null,
      kpiUnit: indicator?.unit ?? null,
      kpiBaseline: indicator?.baseline ?? null,
      kpiTarget: indicator?.target ?? null,
      kpiCurrent: indicator?.current ?? null,
    },
  });
  await appendAudit({
    actorId: scope.userId,
    actorLabel,
    divisionId: scope.divisionId,
    action: "PROJECT_UPDATED",
    objectLabel: `${p.code} · ${p.name}`,
    result: "SUCCESS",
    metadata: { indicator: indicator === null ? null : { baseline: indicator.baseline, target: indicator.target, current: indicator.current } },
  });
  return { name: p.name };
}

/**
 * Demande de revue de passage de la phase en cours. Il faut un sponsor, et aucune
 * revue en attente ni déjà accordée pour cette phase. Le sponsor est prévenu par e-mail ;
 * un échec d'envoi n'annule pas la demande.
 */
export async function requestTollgate(scope: DivisionScope, projectId: string, note: string, now: Date, actorLabel: string) {
  const created = await prisma.$transaction(async (tx) => {
    const p = await managedDmaic(scope, projectId, tx);
    const tollgates = await tx.projectTollgate.findMany({ where: { projectId: p.id } });
    const refusal = requestRefusal(p.sponsorId !== null, tollgates, p.phase);
    if (refusal) throw new DmaicRuleError(refusal);
    const done = new Set((await tx.projectDeliverable.findMany({ where: { projectId: p.id }, select: { key: true } })).map((d) => d.key));
    await tx.projectTollgate.create({
      data: { divisionId: scope.divisionId, projectId: p.id, phase: p.phase, requestedById: scope.userId, requestedAt: now, note: note.trim().slice(0, 2000) || null },
    });
    const sponsor = await tx.user.findUniqueOrThrow({ where: { id: p.sponsorId! }, select: { email: true, firstName: true, lastName: true } });
    return { p, sponsor, progress: deliverableProgress(p.phase, done) };
  });
  const { p, sponsor, progress } = created;
  const project = `${p.code} · ${p.name}`;
  await appendAudit({
    actorId: scope.userId,
    actorLabel,
    divisionId: scope.divisionId,
    action: "PROJECT_TOLLGATE_REQUESTED",
    objectLabel: project,
    result: "SUCCESS",
    metadata: { phase: p.phase },
  });
  const mailed = await sendMail(
    tollgateRequestMail({
      to: sponsor.email,
      firstName: sponsor.firstName,
      project,
      phase: phaseLabel(p.phase),
      url: appUrl(`/projets/${p.id}/dmaic`),
      requester: actorLabel,
      done: progress.done,
      total: progress.total,
      note: note.trim() || null,
    }),
  );
  return { name: p.name, phase: p.phase, sponsor: fullName(sponsor), mailed };
}

/**
 * Décision du sponsor sur la revue en attente de la phase en cours. Passage accordé :
 * le projet entre dans la phase suivante (historique daté, journal), sauf après
 * « Contrôler » où la démarche est close. Compléments : commentaire obligatoire.
 * Qui a demandé la revue est prévenu par e-mail.
 */
export async function decideTollgate(scope: DivisionScope, projectId: string, decision: "APPROVE" | "CHANGES", comment: string, now: Date, actorLabel: string) {
  const checked = checkDecision(decision, comment);
  if (!checked.ok) throw new DmaicRuleError("commentMissing");
  const r = await prisma.$transaction(async (tx) => {
    const p = await tx.project.findFirst({ where: { id: projectId, ...followUpWhere(scope) } });
    if (!p) throw new ProjectRuleError("notFound");
    if (p.kind !== "DMAIC" || p.phase === null) throw new ProjectRuleError("notDmaic");
    if (p.archivedAt !== null) throw new DmaicRuleError("archived");
    if (p.sponsorId !== scope.userId) throw new DmaicRuleError("notSponsor");
    const phase = p.phase;
    const pending = latestTollgate(await tx.projectTollgate.findMany({ where: { projectId: p.id } }), phase);
    if (pending?.status !== "REQUESTED") throw new DmaicRuleError("notRequested");
    const approved = decision === "APPROVE";
    const next = approved ? phaseAfterApproval(phase) : null;
    await tx.projectTollgate.update({
      where: { id: pending.id },
      data: { status: approved ? "APPROVED" : "CHANGES_REQUESTED", decidedById: scope.userId, decidedAt: now, comment: checked.comment },
    });
    if (next) {
      await tx.project.update({ where: { id: p.id }, data: { phase: next } });
      await tx.projectPhaseChange.create({ data: { divisionId: scope.divisionId, projectId: p.id, phase: next, at: now, changedById: scope.userId } });
    }
    const requester = pending.requestedById
      ? await tx.user.findUnique({ where: { id: pending.requestedById }, select: { email: true, firstName: true, lastName: true, active: true } })
      : null;
    return { p, phase, next, approved, requester };
  });
  const project = `${r.p.code} · ${r.p.name}`;
  await appendAudit({
    actorId: scope.userId,
    actorLabel,
    divisionId: scope.divisionId,
    action: "PROJECT_TOLLGATE_DECIDED",
    objectLabel: project,
    result: "SUCCESS",
    metadata: { phase: r.phase, decision: r.approved ? "APPROVED" : "CHANGES_REQUESTED" },
  });
  if (r.next) {
    await appendAudit({
      actorId: scope.userId,
      actorLabel,
      divisionId: scope.divisionId,
      action: "PROJECT_PHASE_CHANGED",
      objectLabel: project,
      result: "SUCCESS",
      metadata: { from: r.phase, to: r.next, tollgate: true },
    });
  }
  let mailed = false;
  if (r.requester?.active) {
    mailed = await sendMail(
      tollgateDecisionMail({
        to: r.requester.email,
        firstName: r.requester.firstName,
        project,
        phase: phaseLabel(r.phase),
        url: appUrl(`/projets/${r.p.id}/dmaic`),
        sponsor: actorLabel,
        approved: r.approved,
        next: r.next ? phaseLabel(r.next) : null,
        comment: checked.comment,
      }),
    );
  }
  return { name: r.p.name, approved: r.approved, next: r.next, requester: r.requester ? fullName(r.requester) : null, mailed };
}

