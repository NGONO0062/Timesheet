// Règles d'affichage de l'écran 06 (repris de app/(app)/fiche-presence/view.ts) : circuit,
// texte de l'étape, note sur les blocs vides, état de l'envoi aux RH.
import { dict, t } from "@/shared/i18n";
import { capitalize, formatDate, formatDateAt, formatTime, zonedDay } from "@/shared/lib/format";
import type { AttendanceStatus } from "@/shared/lib/status";
import type { AttendanceSheet, AttendanceSignature } from "../api/types";

const a = dict.attendance;

/** Blocs d'une semaine sur la feuille OCM/PS-01/SE/049. */
export const SHEET_BLOCKS = 6;

/** « Février 2026 ». */
export const monthLabel = (year: number, month: number) => `${capitalize(dict.months[month - 1] ?? "")} ${year}`;

/** Étape en cours du Stepped process (0 = « Fiche générée » ; 4 : circuit terminé). */
export function currentStep(status: AttendanceStatus): number {
  return { GENERATED: 1, SIGNED_BY_INTERN: 2, SIGNED_BY_SUPERVISOR: 3, SENT: 4 }[status];
}

/** « 20 mars 2026 à 10:48 ». */
export const signedOn = (s: AttendanceSignature) => {
  const at = new Date(s.signedAt);
  return t(a.signedOn, { date: formatDate(zonedDay(at)), time: formatTime(at) });
};

const weeksText = (n: number) => a.weeksCount[n - 1] ?? "";

/** Texte sous le circuit, côté stagiaire ou superviseur. */
export function stepText(s: AttendanceSheet, supervisor: boolean): string {
  const supervisorSig = s.supervisorSignature;
  const sent = s.sentAt ? formatDateAt(new Date(s.sentAt)) : "";
  if (supervisor) {
    if (s.status === "SIGNED_BY_INTERN") return t(a.stepTextSupervisor.SIGNED_BY_INTERN, { intern: s.internName, signed: s.internSignature ? signedOn(s.internSignature) : "" });
    if (s.status === "SIGNED_BY_SUPERVISOR") return t(a.stepTextSupervisor.SIGNED_BY_SUPERVISOR, { signed: supervisorSig ? signedOn(supervisorSig) : "" });
    return t(a.stepTextSupervisor.SENT, { sent });
  }
  switch (s.status) {
    case "GENERATED":
      return t(a.stepText.GENERATED, { date: formatDate(zonedDay(new Date(s.generatedAt))), weeks: weeksText(s.usedWeeks) });
    case "SIGNED_BY_INTERN":
      return t(a.stepText.SIGNED_BY_INTERN, { signed: s.internSignature ? signedOn(s.internSignature) : "", supervisor: s.supervisorName });
    case "SIGNED_BY_SUPERVISOR":
      return t(a.stepText.SIGNED_BY_SUPERVISOR, { supervisor: supervisorSig?.name ?? s.supervisorName, signed: supervisorSig ? signedOn(supervisorSig) : "" });
    default:
      return t(a.stepText.SENT, { sent });
  }
}

/** « Les deux derniers blocs restent vides : février 2026 compte quatre semaines. » */
export function blocksNote(s: Pick<AttendanceSheet, "year" | "month" | "usedWeeks">): string {
  const empty = SHEET_BLOCKS - s.usedWeeks;
  if (empty <= 0) return "";
  const params = { n: a.blocksWords[empty] ?? String(empty), month: monthLabel(s.year, s.month).toLowerCase(), weeks: weeksText(s.usedWeeks) };
  return t(empty === 1 ? a.blocksNoteOne : a.blocksNoteMany, params);
}

/** Renvoi par le superviseur : alerte affichée au stagiaire tant qu'il n'a pas signé de nouveau. */
export function rejectedAlert(s: AttendanceSheet): string | null {
  if (s.status !== "GENERATED" || !s.rejectionReason) return null;
  return t(a.rejectedAlert, { supervisor: s.supervisorName, date: s.rejectedAt ? formatDate(zonedDay(new Date(s.rejectedAt))) : "", reason: s.rejectionReason });
}

/** Bloc « Envoi aux RH ». `canSend` : superviseur, fiche contre-signée, adresse connue. */
export function hrView(s: AttendanceSheet, supervisor: boolean) {
  return {
    recipient: s.hrEmail ?? a.recipientMissing,
    missing: !s.hrEmail,
    state: s.status === "SENT" && s.sentAt ? t(a.sentOn, { date: formatDateAt(new Date(s.sentAt)) }) : a.notSent,
    canSend: supervisor && s.status === "SIGNED_BY_SUPERVISOR" && Boolean(s.hrEmail),
    manual: !s.hrAutoSend,
  };
}

/** Message d'une erreur de règle renvoyée par l'API (code). */
export function attendanceError(code: string): string {
  switch (code) {
    case "wrongPassword":
      return a.wrongPassword;
    case "throttled":
      return a.throttled;
    case "drawing":
      return dict.sign.needDrawing;
    case "reason":
      return a.rejectReasonMissing;
    case "hrEmail":
      return a.hrMissingHelp;
    case "sendFailed":
      return a.sendError;
    default:
      return a.stale;
  }
}
