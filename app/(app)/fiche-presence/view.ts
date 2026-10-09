import "server-only";
// Vue de l'écran 06, côté stagiaire ou superviseur, à partir de la fiche lue en base.
import { SHEET_TEMPLATE } from "@/lib/attendance/config";
import { currentStep, monthLabel } from "@/lib/attendance/sheet";
import type { AttendanceView } from "@/lib/data/attendance";
import { formatDate, formatDateAt, formatTime, zonedDay } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { attendancePdfHref } from "@/lib/routes";
import { roleLabel, type Viewer } from "@/lib/viewer";
import type { AttendanceScreenView, SignatureView } from "./AttendanceScreen";

const a = dict.attendance;

type Sig = NonNullable<AttendanceView["internSignature"]>;

const signedOn = (s: Sig) => t(a.signedOn, { date: formatDate(zonedDay(s.signedAt)), time: formatTime(s.signedAt) });

function signatureView(s: Sig | null, role: string): SignatureView | null {
  if (!s) return null;
  return { name: s.name, role, method: s.method, drawing: s.drawing, signedAt: s.signedAt.toISOString(), date: formatDate(zonedDay(s.signedAt)), time: formatTime(s.signedAt), sha256: s.sha256 };
}

function blocksNote(v: AttendanceView): string {
  const empty = SHEET_TEMPLATE.blocks - v.usedWeeks;
  if (empty <= 0) return "";
  const params = { n: a.blocksWords[empty] ?? String(empty), month: monthLabel(v.year, v.month).toLowerCase(), weeks: a.weeksCount[v.usedWeeks - 1] ?? "" };
  return t(empty === 1 ? a.blocksNoteOne : a.blocksNoteMany, params);
}

function hrView(v: AttendanceView, supervisor: boolean): AttendanceScreenView["hr"] {
  return {
    recipient: v.hrEmail ?? a.recipientMissing,
    missing: !v.hrEmail,
    state: v.status === "SENT" && v.sentAt ? t(a.sentOn, { date: formatDateAt(v.sentAt) }) : a.notSent,
    canSend: supervisor && v.status === "SIGNED_BY_SUPERVISOR" && Boolean(v.hrEmail),
    manual: !v.hrAutoSend,
  };
}

/** Écran 06 du stagiaire. */
export function internScreen(v: AttendanceView & { rejectedAt: Date | null }, viewer: Viewer, now: Date, periods: AttendanceScreenView["periods"], periodHref: string): AttendanceScreenView {
  const supervisorSig = v.supervisorSignature;
  const stepText =
    v.status === "GENERATED"
      ? t(a.stepText.GENERATED, { date: formatDate(zonedDay(v.generatedAt)), weeks: a.weeksCount[v.usedWeeks - 1] ?? "" })
      : v.status === "SIGNED_BY_INTERN"
        ? t(a.stepText.SIGNED_BY_INTERN, { signed: v.internSignature ? signedOn(v.internSignature) : "", supervisor: v.supervisorName })
        : v.status === "SIGNED_BY_SUPERVISOR"
          ? t(a.stepText.SIGNED_BY_SUPERVISOR, { supervisor: supervisorSig?.name ?? v.supervisorName, signed: supervisorSig ? signedOn(supervisorSig) : "" })
          : t(a.stepText.SENT, { sent: v.sentAt ? formatDateAt(v.sentAt) : "" });
  return {
    mode: "intern",
    sheetId: v.id,
    status: v.status,
    title: a.title,
    breadcrumb: [{ label: dict.dashboard.title, href: "/tableau-de-bord" }, { label: a.navLabel }],
    periods,
    periodHref,
    steps: [...a.steps],
    step: currentStep(v.status),
    stepText,
    alert:
      v.status === "GENERATED" && v.rejectionReason
        ? t(a.rejectedAlert, { supervisor: v.supervisorName, date: v.rejectedAt ? formatDate(zonedDay(v.rejectedAt)) : "", reason: v.rejectionReason })
        : null,
    fileName: v.fileName,
    html: v.html,
    pdfHref: attendancePdfHref(v.id),
    timesNote: t(a.timesNote, { arrival: v.intern.arrival, departure: v.intern.departure }),
    blocksNote: blocksNote(v),
    signer: { name: `${viewer.firstName} ${viewer.lastName}`, role: roleLabel(viewer.role), defaultMode: viewer.defaultSignatureMode },
    now: { date: formatDate(zonedDay(now)), time: formatTime(now) },
    canSign: v.status === "GENERATED",
    mine: signatureView(v.internSignature, roleLabel(viewer.role)),
    other: null,
    observation: v.observation,
    hr: hrView(v, false),
    internName: v.intern.name,
  };
}

/** Écran 06 repris côté superviseur (PROMPT.md §19). */
export function supervisorScreen(v: AttendanceView, viewer: Viewer, now: Date): AttendanceScreenView {
  const label = monthLabel(v.year, v.month);
  const supervisorSig = v.supervisorSignature;
  const stepText =
    v.status === "SIGNED_BY_INTERN"
      ? t(a.stepTextSupervisor.SIGNED_BY_INTERN, { intern: v.intern.name, signed: v.internSignature ? signedOn(v.internSignature) : "" })
      : v.status === "SIGNED_BY_SUPERVISOR"
        ? t(a.stepTextSupervisor.SIGNED_BY_SUPERVISOR, { signed: supervisorSig ? signedOn(supervisorSig) : "" })
        : t(a.stepTextSupervisor.SENT, { sent: v.sentAt ? formatDateAt(v.sentAt) : "" });
  return {
    mode: "supervisor",
    sheetId: v.id,
    status: v.status,
    title: t(a.supervisorDetailTitle, { name: v.intern.name, month: label }),
    breadcrumb: [{ label: dict.validation.title, href: "/validation/presence" }, { label: t(a.supervisorDetailTitle, { name: v.intern.name, month: label }) }],
    periods: [],
    periodHref: "",
    steps: [...a.stepsSupervisor],
    step: currentStep(v.status),
    stepText,
    alert: null,
    fileName: v.fileName,
    html: v.html,
    pdfHref: attendancePdfHref(v.id),
    timesNote: null,
    blocksNote: blocksNote(v),
    signer: { name: `${viewer.firstName} ${viewer.lastName}`, role: roleLabel(viewer.role), defaultMode: viewer.defaultSignatureMode },
    now: { date: formatDate(zonedDay(now)), time: formatTime(now) },
    canSign: v.status === "SIGNED_BY_INTERN",
    mine: signatureView(supervisorSig, roleLabel(viewer.role)),
    other: signatureView(v.internSignature, a.roleIntern),
    observation: v.observation,
    hr: hrView(v, true),
    internName: v.intern.name,
  };
}
