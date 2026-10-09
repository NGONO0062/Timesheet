import "server-only";
// Fiche de présence RH (PROMPT.md §9.7, §9.8) : génération mensuelle, signatures du
// stagiaire puis du superviseur, renvoi, PDF signé, envoi aux RH. Portée : le stagiaire
// sur ses fiches ; son manager (ou l'owner de la division) pour la contre-signature.
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { sheetDocument, sheetHtml, type PrintedSignature } from "@/lib/attendance/html";
import { buildSheet, monthLabel, monthsOfWeek, nextAttendanceStatus, sheetFileName, weeksOfMonth, type SheetModel } from "@/lib/attendance/sheet";
import { htmlToPdf } from "@/lib/export/pdf";
import { formatDate, zonedDay } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { mondayOf } from "@/lib/iso-week";
import { attendanceHrMail, attendanceRejectedMail, attendanceSupervisorMail, attendanceToSignMail } from "@/lib/mail/templates";
import { appUrl, sendMail } from "@/lib/mail/send";
import { wantsNotification } from "@/lib/notifications";
import { verifyPassword } from "@/lib/password";
import { attendanceHref, supervisorAttendanceHref } from "@/lib/routes";
import type { AttendanceStatus } from "@/lib/status";
import { readStored, writeStored } from "@/lib/storage";
import { appendAudit } from "./audit";
import { AccessDenied, assertPermission, assertScope, prisma, type DivisionScope } from "./db";

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

/** Limitation des tentatives du mode mot de passe : 5 échecs en 15 minutes. */
const PASSWORD_ATTEMPTS = 5;
const PASSWORD_WINDOW_MS = 15 * 60_000;

export class AttendanceRuleError extends Error {
  constructor(public readonly code: "notFound" | "stale" | "wrongPassword" | "throttled" | "drawing" | "reason" | "hrEmail" | "sendFailed") {
    super(code);
  }
}

const include = {
  user: { include: { internship: true, manager: { select: { id: true, firstName: true, lastName: true, email: true, notificationPrefs: true } } } },
  signatures: { where: { cancelledAt: null }, orderBy: { signedAt: "asc" }, include: { signer: { select: { firstName: true, lastName: true } } } },
  division: { include: { settings: true } },
} satisfies Prisma.AttendanceSheetInclude;

type SheetRecord = Prisma.AttendanceSheetGetPayload<{ include: typeof include }>;

// ---------------------------------------------------------------------------
// Contenu, PDF
// ---------------------------------------------------------------------------

/** Heures validées du mois, jour par jour, dont l'activité système « Absence ». */
async function monthDays(divisionId: string, userId: string, year: number, month: number) {
  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) },
      line: { timesheet: { divisionId, userId, status: "VALIDATED" } },
    },
    select: { date: true, hours: true, line: { select: { project: { select: { isSystem: true } } } } },
  });
  const byDay = new Map<number, { date: Date; hours: number; absence: number }>();
  for (const e of entries) {
    const day = byDay.get(e.date.getTime()) ?? { date: e.date, hours: 0, absence: 0 };
    day.hours += Number(e.hours);
    if (e.line.project.isSystem) day.absence += Number(e.hours);
    byDay.set(e.date.getTime(), day);
  }
  return [...byDay.values()];
}

async function modelOf(sheet: SheetRecord): Promise<SheetModel> {
  const internship = sheet.user.internship;
  if (!internship) throw new AccessDenied("fiche de présence sans stage");
  const model = buildSheet({
    year: sheet.year,
    month: sheet.month,
    firstName: sheet.user.firstName,
    lastName: sheet.user.lastName,
    internship,
    arrival: sheet.user.usualArrival,
    departure: sheet.user.usualDeparture,
    days: await monthDays(sheet.divisionId, sheet.userId, sheet.year, sheet.month),
    observation: sheet.observation,
  });
  return { ...model, absenceDays: sheet.absenceDays || model.absenceDays };
}

const fileNameOf = (sheet: SheetRecord) => sheetFileName(sheet.year, sheet.month, sheet.user.lastName);

function printed(sheet: SheetRecord): PrintedSignature | null {
  const s = sheet.signatures.find((x) => x.signerRole !== "STAFF");
  if (!s) return null;
  return { name: fullName(s.signer), drawing: s.method === "DRAWN" ? s.drawing : null, note: t(dict.attendance.printedNote, { date: formatDate(zonedDay(s.signedAt)) }) };
}

async function renderPdf(sheet: SheetRecord, signature: PrintedSignature | null): Promise<Uint8Array> {
  return htmlToPdf(sheetDocument(await modelOf(sheet), signature, fileNameOf(sheet)), { landscape: true, fullBleed: true });
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const storedPath = (sheet: { divisionId: string; id: string }) => `fiches-presence/${sheet.divisionId}/${sheet.id}.pdf`;

// ---------------------------------------------------------------------------
// Génération (après chaque validation de fiche de temps)
// ---------------------------------------------------------------------------

/**
 * Génère la fiche de présence d'un stagiaire pour chaque mois touché par la semaine
 * validée, si toutes les semaines du mois sont validées. Idempotent.
 */
export async function generateAttendanceIfReady(divisionId: string, userId: string, week: { year: number; week: number }, now: Date): Promise<void> {
  const user = await prisma.user.findFirst({ where: { id: userId, divisionId }, include: { internship: true } });
  if (!user?.internship) return;
  for (const { year, month } of monthsOfWeek(mondayOf(week))) {
    const exists = await prisma.attendanceSheet.findUnique({ where: { userId_year_month: { userId, year, month } } });
    if (exists) continue;
    const weeks = weeksOfMonth(year, month, user.internship);
    if (weeks.length === 0) continue;
    const validated = await prisma.timesheet.count({
      where: { divisionId, userId, status: "VALIDATED", OR: weeks.map((w) => ({ isoYear: w.year, isoWeek: w.week })) },
    });
    if (validated < weeks.length) continue;
    const created = await prisma.attendanceSheet.create({ data: { divisionId, userId, year, month, status: "GENERATED", generatedAt: now } });
    const label = monthLabel(year, month);
    await appendAudit({ actorId: null, actorLabel: "TimeSheet", divisionId, action: "ATTENDANCE_GENERATED", objectLabel: `${label} · ${fullName(user)}`, result: "SUCCESS", metadata: { sheetId: created.id } });
    if (wantsNotification(user.notificationPrefs, "signatureReminder")) {
      await sendMail(attendanceToSignMail({ to: user.email, firstName: user.firstName, month: label.toLowerCase(), url: appUrl(attendanceHref(year, month)) }));
    }
  }
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Fiches que le contexte peut contre-signer : celles de ses rattachés (toute la division pour l'owner). */
function supervised(scope: DivisionScope): Prisma.AttendanceSheetWhereInput {
  assertPermission(scope, "VALIDATE_TEAM");
  return { divisionId: scope.divisionId, userId: { not: scope.userId }, ...(scope.role === "OWNER" ? {} : { user: { managerId: scope.userId } }) };
}

export type AttendanceView = Awaited<ReturnType<typeof viewOf>>;

async function viewOf(sheet: SheetRecord) {
  const model = await modelOf(sheet);
  const intern = sheet.signatures.find((s) => s.signerRole === "STAFF") ?? null;
  const supervisor = sheet.signatures.find((s) => s.signerRole !== "STAFF") ?? null;
  const settings = sheet.division.settings;
  const sig = (s: typeof intern) =>
    s && { name: fullName(s.signer), method: s.method, drawing: s.drawing, signedAt: s.signedAt, sha256: s.documentSha256 };
  return {
    id: sheet.id,
    year: sheet.year,
    month: sheet.month,
    status: sheet.status as AttendanceStatus,
    generatedAt: sheet.generatedAt,
    fileName: fileNameOf(sheet),
    html: sheetHtml(model, printed(sheet)),
    usedWeeks: weeksOfMonth(sheet.year, sheet.month).length,
    intern: { id: sheet.userId, name: fullName(sheet.user), firstName: sheet.user.firstName, arrival: sheet.user.usualArrival, departure: sheet.user.usualDeparture },
    supervisorName: sheet.user.manager ? fullName(sheet.user.manager) : "",
    internSignature: sig(intern),
    supervisorSignature: sig(supervisor),
    pdfSha256: sheet.pdfSha256,
    rejectionReason: sheet.rejectionReason,
    sentAt: sheet.sentAt,
    sentTo: sheet.sentTo,
    hrEmail: settings?.hrEmail ?? null,
    hrAutoSend: settings?.hrAutoSend ?? true,
    observation: sheet.observation ?? "",
  };
}

/** Mois des fiches du stagiaire connecté, du plus récent au plus ancien. */
export async function listMySheets(scope: DivisionScope) {
  assertPermission(scope, "ENTER_TIME");
  return prisma.attendanceSheet.findMany({
    where: { divisionId: scope.divisionId, userId: scope.userId },
    select: { year: true, month: true, status: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getMySheet(scope: DivisionScope, year: number, month: number) {
  assertPermission(scope, "ENTER_TIME");
  const sheet = await prisma.attendanceSheet.findFirst({ where: { divisionId: scope.divisionId, userId: scope.userId, year, month }, include });
  if (!sheet) return null;
  const view = await viewOf(sheet);
  // Renvoi : qui et quand, d'après le journal d'audit (la signature annulée reste en base).
  const cancelled = view.status === "GENERATED" && sheet.rejectionReason
    ? await prisma.signature.findFirst({ where: { attendanceSheetId: sheet.id, cancelledAt: { not: null } }, orderBy: { cancelledAt: "desc" } })
    : null;
  return { ...view, rejectedAt: cancelled?.cancelledAt ?? null };
}

/** Fiches à contre-signer (et celles signées dont l'envoi aux RH attend). */
export async function listSheetsToCountersign(scope: DivisionScope) {
  const sheets = await prisma.attendanceSheet.findMany({
    where: { ...supervised(scope), status: { in: ["SIGNED_BY_INTERN", "SIGNED_BY_SUPERVISOR"] } },
    include: { user: { select: { firstName: true, lastName: true } }, signatures: { where: { cancelledAt: null, signerRole: "STAFF" }, select: { signedAt: true } } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  return sheets.map((s) => ({ id: s.id, name: fullName(s.user), year: s.year, month: s.month, status: s.status as AttendanceStatus, internSignedAt: s.signatures[0]?.signedAt ?? null }));
}

/** Fiches à contre-signer ; null si le contexte ne supervise aucun stagiaire (pas d'onglet). */
export async function countSheetsToCountersign(scope: DivisionScope): Promise<number | null> {
  assertPermission(scope, "VALIDATE_TEAM");
  const interns = await prisma.user.count({
    where: { divisionId: scope.divisionId, id: { not: scope.userId }, internship: { isNot: null }, ...(scope.role === "OWNER" ? {} : { managerId: scope.userId }) },
  });
  if (interns === 0) return null;
  return prisma.attendanceSheet.count({ where: { ...supervised(scope), status: "SIGNED_BY_INTERN" } });
}

export async function getSupervisedSheet(scope: DivisionScope, id: string) {
  const sheet = await prisma.attendanceSheet.findFirst({ where: { id, ...supervised(scope), status: { not: "GENERATED" } }, include });
  return sheet ? viewOf(sheet) : null;
}

/** Stagiaire d'une fiche renvoyée par le superviseur : message de la file après le renvoi. */
export async function returnedSheetIntern(scope: DivisionScope, id: string): Promise<string | null> {
  const sheet = await prisma.attendanceSheet.findFirst({
    where: { id, ...supervised(scope), status: "GENERATED", rejectionReason: { not: null } },
    select: { user: { select: { firstName: true, lastName: true } } },
  });
  return sheet ? fullName(sheet.user) : null;
}

/** PDF pour le téléchargement : le stagiaire, ou son superviseur. Le PDF signé stocké s'il existe. */
export async function attendancePdf(scope: DivisionScope, id: string): Promise<{ fileName: string; bytes: Uint8Array } | null> {
  assertScope(scope);
  const own: Prisma.AttendanceSheetWhereInput = { divisionId: scope.divisionId, userId: scope.userId };
  const where: Prisma.AttendanceSheetWhereInput = scope.permissions.has("VALIDATE_TEAM") ? { id, OR: [own, supervised(scope)] } : { id, ...own };
  const sheet = await prisma.attendanceSheet.findFirst({ where, include });
  if (!sheet) return null;
  const stored = sheet.pdfPath ? await readStored(sheet.pdfPath) : null;
  return { fileName: fileNameOf(sheet), bytes: stored ?? (await renderPdf(sheet, printed(sheet))) };
}

// ---------------------------------------------------------------------------
// Signatures, renvoi, envoi
// ---------------------------------------------------------------------------

export type SignInput = { method: "DRAWN" | "PASSWORD"; drawing?: string; password?: string; observation?: string };
type Meta = { now: Date; actorLabel: string; ip?: string | null; userAgent?: string | null };

/** Tracé SVG produit par la zone de signature : commandes M et L, coordonnées entières. */
const DRAWING = /^(?:[ML] -?\d{1,4} -?\d{1,4}\s*)+$/;

async function checkSigner(scope: DivisionScope, input: SignInput, meta: Meta, objectLabel: string) {
  if (input.method === "DRAWN") {
    if (!input.drawing || input.drawing.length > 20_000 || !DRAWING.test(input.drawing.trim())) throw new AttendanceRuleError("drawing");
    return;
  }
  // Fenêtre de sécurité en heure réelle : l'horloge de démonstration repart à chaque démarrage.
  const since = new Date(Date.now() - PASSWORD_WINDOW_MS);
  const failures = await prisma.auditLog.count({ where: { action: "ATTENDANCE_SIGNATURE_FAILURE", actorId: scope.userId, recordedAt: { gte: since } } });
  if (failures >= PASSWORD_ATTEMPTS) throw new AttendanceRuleError("throttled");
  const user = await prisma.user.findUnique({ where: { id: scope.userId }, select: { passwordHash: true } });
  if (!user?.passwordHash || !input.password || !(await verifyPassword(input.password, user.passwordHash))) {
    await appendAudit({ actorId: scope.userId, actorLabel: meta.actorLabel, divisionId: scope.divisionId, action: "ATTENDANCE_SIGNATURE_FAILURE", objectLabel, result: "FAILURE", metadata: { ip: meta.ip ?? null } });
    throw new AttendanceRuleError(failures + 1 >= PASSWORD_ATTEMPTS ? "throttled" : "wrongPassword");
  }
}

/** Signature du stagiaire : certifie la fiche, n'est pas imprimée (§9.7). */
export async function signAsIntern(scope: DivisionScope, id: string, input: SignInput, meta: Meta) {
  assertPermission(scope, "ENTER_TIME");
  const sheet = await prisma.attendanceSheet.findFirst({ where: { id, divisionId: scope.divisionId, userId: scope.userId }, include });
  if (!sheet) throw new AttendanceRuleError("notFound");
  const next = nextAttendanceStatus(sheet.status as AttendanceStatus, "INTERN_SIGN");
  if (!next) throw new AttendanceRuleError("stale");
  const label = `${monthLabel(sheet.year, sheet.month)} · ${fullName(sheet.user)}`;
  await checkSigner(scope, input, meta, label);

  const digest = sha256(await renderPdf(sheet, null));
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.attendanceSheet.updateMany({ where: { id, status: sheet.status }, data: { status: next, rejectionReason: null } });
    if (count === 0) return false;
    await tx.signature.create({
      data: { attendanceSheetId: id, signerId: scope.userId, signerRole: "STAFF", method: input.method, drawing: input.method === "DRAWN" ? input.drawing!.trim() : null, signedAt: meta.now, documentSha256: digest, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null },
    });
    return true;
  });
  if (!changed) throw new AttendanceRuleError("stale");
  await appendAudit({ actorId: scope.userId, actorLabel: meta.actorLabel, divisionId: scope.divisionId, action: "ATTENDANCE_SIGNED", objectLabel: label, result: "SUCCESS", metadata: { role: "STAFF", method: input.method, sha256: digest } });

  const manager = sheet.user.manager;
  if (manager && wantsNotification(manager.notificationPrefs, "signatureReminder")) {
    await sendMail(attendanceSupervisorMail({ to: manager.email, firstName: manager.firstName, name: fullName(sheet.user), month: monthLabel(sheet.year, sheet.month).toLowerCase(), url: appUrl(supervisorAttendanceHref(id)) }));
  }
  return { supervisor: manager ? fullName(manager) : "" };
}

/** Signature du superviseur : imprimée sur le PDF, stocké avec son empreinte, puis envoi aux RH. */
export async function signAsSupervisor(scope: DivisionScope, id: string, input: SignInput, meta: Meta) {
  const sheet = await prisma.attendanceSheet.findFirst({ where: { id, ...supervised(scope) }, include });
  if (!sheet) throw new AttendanceRuleError("notFound");
  const next = nextAttendanceStatus(sheet.status as AttendanceStatus, "SUPERVISOR_SIGN");
  if (!next) throw new AttendanceRuleError("stale");
  const label = `${monthLabel(sheet.year, sheet.month)} · ${fullName(sheet.user)}`;
  await checkSigner(scope, input, meta, label);

  const me = await prisma.user.findUniqueOrThrow({ where: { id: scope.userId }, select: { firstName: true, lastName: true } });
  const observation = input.observation?.trim().slice(0, 500) || null;
  const signature: PrintedSignature = {
    name: fullName(me),
    drawing: input.method === "DRAWN" ? input.drawing!.trim() : null,
    note: t(dict.attendance.printedNote, { date: formatDate(zonedDay(meta.now)) }),
  };
  const pdf = await renderPdf({ ...sheet, observation }, signature);
  const digest = sha256(pdf);
  const path = storedPath(sheet);
  await writeStored(path, pdf);

  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.attendanceSheet.updateMany({ where: { id, status: sheet.status }, data: { status: next, observation, pdfPath: path, pdfSha256: digest } });
    if (count === 0) return false;
    await tx.signature.create({
      data: { attendanceSheetId: id, signerId: scope.userId, signerRole: scope.role, method: input.method, drawing: signature.drawing ?? null, signedAt: meta.now, documentSha256: digest, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null },
    });
    return true;
  });
  if (!changed) throw new AttendanceRuleError("stale");
  await appendAudit({ actorId: scope.userId, actorLabel: meta.actorLabel, divisionId: scope.divisionId, action: "ATTENDANCE_SIGNED", objectLabel: label, result: "SUCCESS", metadata: { role: scope.role, method: input.method, sha256: digest } });

  const settings = sheet.division.settings;
  if (settings?.hrAutoSend !== false && settings?.hrEmail) {
    const sent = await deliver(scope, id, meta);
    return { sent };
  }
  return { sent: null };
}

/** Renvoi au stagiaire : sa signature est annulée (jamais supprimée). */
export async function rejectAsSupervisor(scope: DivisionScope, id: string, reason: string, meta: Meta) {
  const motif = reason.trim();
  if (!motif) throw new AttendanceRuleError("reason");
  const sheet = await prisma.attendanceSheet.findFirst({ where: { id, ...supervised(scope) }, include });
  if (!sheet) throw new AttendanceRuleError("notFound");
  const next = nextAttendanceStatus(sheet.status as AttendanceStatus, "SUPERVISOR_REJECT");
  if (!next) throw new AttendanceRuleError("stale");
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.attendanceSheet.updateMany({ where: { id, status: sheet.status }, data: { status: next, rejectionReason: motif.slice(0, 500) } });
    if (count === 0) return false;
    await tx.signature.updateMany({ where: { attendanceSheetId: id, cancelledAt: null }, data: { cancelledAt: meta.now } });
    return true;
  });
  if (!changed) throw new AttendanceRuleError("stale");
  const label = `${monthLabel(sheet.year, sheet.month)} · ${fullName(sheet.user)}`;
  await appendAudit({ actorId: scope.userId, actorLabel: meta.actorLabel, divisionId: scope.divisionId, action: "ATTENDANCE_REJECTED", objectLabel: label, result: "SUCCESS", metadata: { reason: motif } });
  if (wantsNotification(sheet.user.notificationPrefs, "signatureReminder")) {
    await sendMail(attendanceRejectedMail({ to: sheet.user.email, firstName: sheet.user.firstName, supervisor: meta.actorLabel, month: monthLabel(sheet.year, sheet.month).toLowerCase(), reason: motif, url: appUrl(attendanceHref(sheet.year, sheet.month)) }));
  }
  return { name: fullName(sheet.user) };
}

/** Envoi manuel aux RH (réglage d'envoi automatique désactivé, ou nouvel essai). */
export async function sendToHr(scope: DivisionScope, id: string, meta: Meta) {
  const sheet = await prisma.attendanceSheet.findFirst({ where: { id, ...supervised(scope) }, select: { id: true } });
  if (!sheet) throw new AttendanceRuleError("notFound");
  return deliver(scope, id, meta);
}

async function deliver(scope: DivisionScope, id: string, meta: Meta): Promise<string> {
  const sheet = await prisma.attendanceSheet.findFirstOrThrow({ where: { id, divisionId: scope.divisionId }, include });
  if (!nextAttendanceStatus(sheet.status as AttendanceStatus, "SEND")) throw new AttendanceRuleError("stale");
  const to = sheet.division.settings?.hrEmail?.trim();
  if (!to) throw new AttendanceRuleError("hrEmail");
  const pdf = sheet.pdfPath ? await readStored(sheet.pdfPath) : null;
  if (!pdf) throw new AttendanceRuleError("sendFailed");
  const label = `${monthLabel(sheet.year, sheet.month)} · ${fullName(sheet.user)}`;
  const supervisor = sheet.signatures.find((s) => s.signerRole !== "STAFF");
  const ok = await sendMail(
    attendanceHrMail({ to, name: fullName(sheet.user), month: monthLabel(sheet.year, sheet.month).toLowerCase(), supervisor: supervisor ? fullName(supervisor.signer) : "", fileName: fileNameOf(sheet), pdf }),
  );
  await appendAudit({ actorId: scope.userId, actorLabel: meta.actorLabel, divisionId: scope.divisionId, action: "ATTENDANCE_SENT", objectLabel: label, result: ok ? "SUCCESS" : "FAILURE", metadata: { to } });
  if (!ok) throw new AttendanceRuleError("sendFailed");
  await prisma.attendanceSheet.updateMany({ where: { id, status: "SIGNED_BY_SUPERVISOR" }, data: { status: "SENT", sentAt: meta.now, sentTo: to } });
  return to;
}
