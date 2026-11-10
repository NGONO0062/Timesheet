// Écran 06 : fiche de présence du stagiaire, et sa reprise côté superviseur (PROMPT.md §19).
// Circuit en Stepped process, aperçu de la feuille, signature, traçabilité, envoi aux RH.
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  attendanceError,
  attendancePdfHref,
  blocksNote,
  currentStep,
  hrView,
  rejectedAlert,
  stepText,
  useReject,
  useSendToHr,
  useSign,
  type AttendanceSheet,
  type SignInput,
} from "@/entities/attendance";
import { ruleCodeOf } from "@/entities/timesheet";
import { roleLabel, type Viewer } from "@/entities/viewer";
import { SignatureZone, Trace, type SignatureMethod } from "@/features/sign";
import { dict, t } from "@/shared/i18n";
import { formatDate, formatTime, zonedDay } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { Alert, Card } from "@/shared/ui/Display";
import { TextareaField } from "@/shared/ui/Form";
import { Breadcrumb, SteppedProcess } from "@/shared/ui/Navigation";
import { Modal } from "@/shared/ui/Overlay";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { SheetViewer } from "./SheetViewer";

const a = dict.attendance;
const REASON_ID = "motif-renvoi";

const methodLabel = (m: SignatureMethod) => (m === "DRAWN" ? dict.sign.methodDrawn : dict.sign.methodPassword);
const dayAndTime = (iso: string) => {
  const at = new Date(iso);
  return { date: formatDate(zonedDay(at)), time: formatTime(at) };
};

type Props = {
  sheet: AttendanceSheet;
  viewer: Viewer;
  supervisor?: boolean;
  title: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  /** Liste « Période » (stagiaire) : à droite du titre. */
  period?: ReactNode;
  /** Renvoi réussi : la page retourne à la liste des fiches à signer. */
  onRejected?: (name: string) => void;
};

export function AttendanceScreen({ sheet, viewer, supervisor = false, title, breadcrumb, period, onRejected }: Props) {
  const sign = useSign(sheet.id, supervisor);
  const reject = useReject(sheet.id);
  const send = useSendToHr(sheet.id);
  const [mode, setMode] = useState<SignatureMethod>(viewer.defaultSignatureMode);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [observation, setObservation] = useState(sheet.observation);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  // Avant la signature, la traçabilité montre la date et l'heure d'ouverture de l'écran.
  const [openedAt] = useState(() => new Date().toISOString());

  const mine = supervisor ? sheet.supervisorSignature : sheet.internSignature;
  const other = supervisor ? sheet.internSignature : null;
  const signer = `${viewer.firstName} ${viewer.lastName}`;
  const role = roleLabel(viewer.role);
  const hr = hrView(sheet, supervisor);
  const alert = supervisor ? null : rejectedAlert(sheet);
  const text = stepText(sheet, supervisor);

  async function onSign(input: { method: SignatureMethod; drawing?: string; password?: string }): Promise<string | null> {
    setError(null);
    const body: SignInput = supervisor ? { ...input, observation } : input;
    try {
      const r = await sign.mutateAsync(body);
      if (supervisor) setNotice(r.sentTo ? `${a.signedSupervisor} ${t(a.sentNotice, { to: r.sentTo })}` : r.sendFailed ? a.sendError : a.signedSupervisor);
      else setNotice(t(a.signedIntern, { supervisor: r.supervisor ?? sheet.supervisorName }));
      return null;
    } catch (e) {
      return attendanceError(ruleCodeOf(e));
    }
  }

  function sendNow() {
    setError(null);
    send.mutate(undefined, {
      onSuccess: (r) => setNotice(t(a.sentNotice, { to: r.to })),
      onError: (e) => setError(attendanceError(ruleCodeOf(e))),
    });
  }

  function confirmReject() {
    if (!reason.trim()) {
      setReasonError(true);
      document.getElementById(REASON_ID)?.focus();
      return;
    }
    reject.mutate(reason, {
      onSuccess: (r) => {
        setRejecting(false);
        onRejected?.(r.name);
      },
      onError: (e) => {
        const code = ruleCodeOf(e);
        if (code === "reason") setReasonError(true);
        else {
          setRejecting(false);
          setError(attendanceError(code));
        }
      },
    });
  }

  const at = dayAndTime(mine ? mine.signedAt : openedAt);
  const traceRows: Array<[string, string]> = [
    [dict.sign.signer, `${signer} · ${role}`],
    [dict.sign.date, at.date],
    [dict.sign.time, `${at.time} (UTC+1)`],
    [dict.sign.method, methodLabel(mine ? mine.method : mode)],
    [a.document, sheet.fileName],
    ...(mine?.sha256 ? [[dict.sign.fingerprint, mine.sha256] as [string, string]] : []),
  ];
  const otherAt = other ? dayAndTime(other.signedAt) : null;

  return (
    <main className="flex flex-col gap-30">
      <div className="flex flex-col gap-20">
        <Breadcrumb items={breadcrumb} />
        <div className="flex flex-wrap items-end justify-between gap-20">
          <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
            <h1>{title}</h1>
            <StatusBadge kind="attendance" value={sheet.status} />
          </div>
          {period}
        </div>
      </div>

      {notice && (
        <Alert tone="success" role="status" onClose={() => setNotice(null)}>
          <p>{notice}</p>
        </Alert>
      )}
      {error && (
        <Alert tone="danger" role="alert" onClose={() => setError(null)}>
          <p>{error}</p>
        </Alert>
      )}
      {alert && !notice && (
        <Alert tone="warning">
          <p>{alert}</p>
        </Alert>
      )}

      <section aria-labelledby="titre-transmission" className="flex flex-col gap-10">
        <h2 className="text-h5" id="titre-transmission">
          {a.transmission}
        </h2>
        <SteppedProcess steps={[...(supervisor ? a.stepsSupervisor : a.steps)]} current={currentStep(sheet.status)} label={a.transmissionLabel} />
        <p className="text-sm">{text}</p>
      </section>

      <section aria-labelledby="titre-apercu" className="flex flex-col gap-10">
        <h2 className="text-h3" id="titre-apercu">
          {a.preview}
        </h2>
        <SheetViewer fileName={sheet.fileName} html={sheet.html} pdfHref={attendancePdfHref(sheet.id)} />
        <p className="text-sm text-gray-595">
          {!supervisor && (
            <>
              {t(a.timesNote, { arrival: sheet.arrival, departure: sheet.departure })}
              <Link to="/parametres">{a.timesNoteLink}</Link>.{" "}
            </>
          )}
          {blocksNote(sheet)}
        </p>
      </section>

      <div className="grid gap-20 lg:grid-cols-sign lg:items-start">
        <Card strong aria-labelledby="titre-signature">
          <h2 className="text-h3" id="titre-signature">
            {supervisor ? a.supervisorTitle : a.yourSignature}
          </h2>
          {sheet.canSign || mine ? (
            <SignatureZone
              // Une nouvelle signature (après un renvoi) repart d'une zone vide.
              key={mine?.signedAt ?? "a-signer"}
              variant="sheet"
              signerName={signer}
              signerRole={role}
              defaultMode={viewer.defaultSignatureMode}
              requireCertify={!supervisor}
              onModeChange={setMode}
              signed={mine ? { method: mine.method, drawing: mine.drawing ?? undefined, signedAt: new Date(mine.signedAt), sha256: mine.sha256 } : undefined}
              onSign={onSign}
              extra={
                supervisor ? (
                  <TextareaField label={a.observationLabel} rows={3} maxLength={500} value={observation} onChange={(e) => setObservation(e.target.value)} />
                ) : undefined
              }
            />
          ) : (
            <p className="text-gray-595">{text}</p>
          )}
          {supervisor && sheet.canSign && (
            <div>
              <Button
                onClick={() => {
                  setReasonError(false);
                  setRejecting(true);
                }}
              >
                {a.reject}
              </Button>
            </div>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-20">
          <section aria-labelledby="titre-trace" className="flex flex-col gap-10">
            <h2 className="text-h5" id="titre-trace">
              {a.trace}
            </h2>
            <Trace rows={traceRows} />
            {other && otherAt && (
              <Trace
                rows={[
                  [dict.sign.signer, `${other.name} · ${a.roleIntern}`],
                  [dict.sign.date, otherAt.date],
                  [dict.sign.time, `${otherAt.time} (UTC+1)`],
                  [dict.sign.method, methodLabel(other.method)],
                ]}
              />
            )}
          </section>
          <section aria-labelledby="titre-envoi" className="flex flex-col gap-10">
            <h2 className="text-h5" id="titre-envoi">
              {a.hrTitle}
            </h2>
            <Trace
              label={a.hrTitle}
              rows={[
                [a.channel, a.channelEmail],
                [a.recipient, hr.recipient],
                [a.attachment, sheet.fileName],
                [a.state, hr.state],
              ]}
            />
            {hr.missing && <p className="text-sm">{a.hrMissingHelp}</p>}
            {hr.canSend && (
              <div className="flex flex-col items-start gap-10">
                {hr.manual && <p className="text-sm">{a.sendManual}</p>}
                <Button disabled={send.isPending} onClick={sendNow}>
                  {a.sendNow}
                </Button>
              </div>
            )}
          </section>
          {!supervisor && (
            <Alert tone="info">
              <p>{a.internNotPrinted}</p>
            </Alert>
          )}
        </div>
      </div>

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={t(a.rejectTitle, { name: sheet.internName })}
        footer={
          <>
            <Button onClick={() => setRejecting(false)}>{dict.form.cancel}</Button>
            <Button variant="danger" disabled={reject.isPending} onClick={confirmReject}>
              {a.rejectConfirm}
            </Button>
          </>
        }
      >
        <p>{a.rejectIntro}</p>
        <TextareaField
          id={REASON_ID}
          label={a.rejectReason}
          required
          rows={3}
          value={reason}
          error={reasonError ? a.rejectReasonMissing : undefined}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError(false);
          }}
        />
      </Modal>
    </main>
  );
}
