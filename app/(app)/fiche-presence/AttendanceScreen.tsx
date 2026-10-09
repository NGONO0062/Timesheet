"use client";
// Écran 06 : fiche de présence (stagiaire) et sa reprise côté superviseur (PROMPT.md §19).
// Circuit en Stepped process, aperçu de la feuille, signature, traçabilité, envoi aux RH.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { countersignSheet, returnSheet, sendSheetToHr, signMySheet, type AttendanceError } from "@/app/actions/attendance";
import { Alert } from "@/components/ods/Display";
import { FieldError } from "@/components/ods/Form";
import { Breadcrumb, SteppedProcess } from "@/components/ods/Navigation";
import { Modal } from "@/components/ods/Overlay";
import { SheetViewer } from "@/components/ts/SheetViewer";
import { SignatureZone, type SignatureMethod } from "@/components/ts/SignatureZone";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { dict, t } from "@/lib/i18n";
import type { AttendanceStatus } from "@/lib/status";

const a = dict.attendance;

export type SignatureView = { name: string; role: string; method: SignatureMethod; drawing: string | null; signedAt: string; date: string; time: string; sha256: string | null };

export type AttendanceScreenView = {
  mode: "intern" | "supervisor";
  sheetId: string;
  status: AttendanceStatus;
  title: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  periods: Array<{ href: string; label: string }>;
  periodHref: string;
  steps: string[];
  step: number;
  stepText: string;
  alert: string | null;
  fileName: string;
  html: string;
  pdfHref: string;
  timesNote: string | null;
  blocksNote: string;
  signer: { name: string; role: string; defaultMode: SignatureMethod };
  now: { date: string; time: string };
  canSign: boolean;
  mine: SignatureView | null;
  other: SignatureView | null;
  observation: string;
  hr: { recipient: string; missing: boolean; state: string; canSend: boolean; manual: boolean };
  internName: string;
};

const errorText = (e: AttendanceError) =>
  e === "wrongPassword" ? a.wrongPassword : e === "throttled" ? a.throttled : e === "drawing" ? dict.sign.needDrawing : e === "reason" ? a.rejectReasonMissing : a.stale;

function TraceList({ rows, label }: { rows: Array<[string, string]>; label: string }) {
  return (
    <dl className="ts-trace" aria-label={label}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const methodLabel = (m: SignatureMethod) => (m === "DRAWN" ? dict.sign.methodDrawn : dict.sign.methodPassword);

export function AttendanceScreen({ view }: { view: AttendanceScreenView }) {
  const router = useRouter();
  const [mode, setMode] = useState<SignatureMethod>(view.signer.defaultMode);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [observation, setObservation] = useState(view.observation);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [pending, start] = useTransition();
  const supervisor = view.mode === "supervisor";

  async function sign(input: { method: SignatureMethod; drawing?: string; password?: string }): Promise<string | null> {
    setError(null);
    if (supervisor) {
      const r = await countersignSheet(view.sheetId, { ...input, observation });
      if (!r.ok) return errorText(r.error);
      setNotice(r.sent ? `${a.signedSupervisor} ${t(a.sentNotice, { to: r.sent })}` : r.sendError ? a.sendError : a.signedSupervisor);
      return null;
    }
    const r = await signMySheet(view.sheetId, input);
    if (!r.ok) return errorText(r.error);
    setNotice(t(a.signedIntern, { supervisor: r.supervisor }));
    return null;
  }

  function send() {
    setError(null);
    start(async () => {
      const r = await sendSheetToHr(view.sheetId);
      if (r.ok) setNotice(t(a.sentNotice, { to: r.to }));
      else setError(r.error === "hrEmail" ? a.hrMissingHelp : a.sendError);
    });
  }

  function reject() {
    if (!reason.trim()) {
      setReasonError(true);
      document.getElementById("motif-renvoi")?.focus();
      return;
    }
    // En cas de succès, l'action redirige vers la file, qui affiche la confirmation.
    start(async () => {
      const r = await returnSheet(view.sheetId, reason);
      setRejecting(false);
      setError(errorText(r.error));
    });
  }

  const mine = view.mine;
  const traceRows: Array<[string, string]> = [
    [dict.sign.signer, `${view.signer.name} · ${view.signer.role}`],
    [dict.sign.date, mine ? mine.date : view.now.date],
    [dict.sign.time, `${mine ? mine.time : view.now.time} (UTC+1)`],
    [dict.sign.method, methodLabel(mine ? mine.method : mode)],
    [a.document, view.fileName],
    ...(mine?.sha256 ? [[dict.sign.fingerprint, mine.sha256] as [string, string]] : []),
  ];

  return (
    <main className="container" style={{ display: "flex", flexDirection: "column", gap: 30, padding: "30px 0 60px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Breadcrumb items={view.breadcrumb} />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 20px" }}>
            <h1>{view.title}</h1>
            <StatusBadge kind="attendance" value={view.status} />
          </div>
          {view.periods.length > 0 && (
            <div style={{ width: 280, maxWidth: "100%" }}>
              <label className="form-label" htmlFor="periode">{a.period}</label>
              <select className="form-select" id="periode" value={view.periodHref} onChange={(e) => router.push(e.target.value)}>
                {view.periods.map((p) => (
                  <option key={p.href} value={p.href}>{p.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {notice && (
        <Alert tone="success" role="status">
          <p>{notice}</p>
        </Alert>
      )}
      {error && (
        <Alert tone="danger" role="alert">
          <p>{error}</p>
        </Alert>
      )}
      {view.alert && !notice && (
        <Alert tone="warning">
          <p>{view.alert}</p>
        </Alert>
      )}

      <section aria-labelledby="titre-transmission" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="h5" id="titre-transmission">{a.transmission}</h2>
        <SteppedProcess steps={view.steps} current={view.step} label={a.transmissionLabel} />
        <p className="small">{view.stepText}</p>
      </section>

      <section aria-labelledby="titre-apercu" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="h3" id="titre-apercu">{a.preview}</h2>
        <SheetViewer fileName={view.fileName} html={view.html} pdfHref={view.pdfHref} />
        {(view.timesNote || view.blocksNote) && (
          <p className="small text-secondary">
            {view.timesNote && (
              <>
                {view.timesNote}
                <Link href="/parametres">{a.timesNoteLink}</Link>.{" "}
              </>
            )}
            {view.blocksNote}
          </p>
        )}
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <section className="card card-strong" aria-labelledby="titre-signature" style={{ flex: "3 1 480px", minWidth: 0 }}>
          <h2 className="h3" id="titre-signature">{supervisor ? a.supervisorTitle : a.yourSignature}</h2>
          {view.canSign || mine ? (
            <SignatureZone
              variant="sheet"
              signerName={view.signer.name}
              signerRole={view.signer.role}
              defaultMode={view.signer.defaultMode}
              requireCertify={!supervisor}
              onModeChange={setMode}
              signed={mine ? { method: mine.method, drawing: mine.drawing ?? undefined, signedAt: new Date(mine.signedAt), sha256: mine.sha256 ?? undefined } : undefined}
              onSign={sign}
              extra={
                supervisor ? (
                  <div>
                    <label className="form-label" htmlFor="observation">{a.observationLabel}</label>
                    <textarea className="form-control" id="observation" rows={3} maxLength={500} style={{ height: "auto", padding: 10 }} value={observation} onChange={(e) => setObservation(e.target.value)} />
                  </div>
                ) : undefined
              }
            />
          ) : (
            <p className="text-secondary">{view.stepText}</p>
          )}
          {supervisor && view.canSign && (
            <div>
              <button className="btn" type="button" onClick={() => setRejecting(true)}>{a.reject}</button>
            </div>
          )}
        </section>

        <div style={{ flex: "2 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          <section aria-labelledby="titre-trace" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h5" id="titre-trace">{a.trace}</h2>
            <TraceList rows={traceRows} label={dict.sign.trace} />
            {view.other && (
              <TraceList
                label={dict.sign.trace}
                rows={[
                  [dict.sign.signer, `${view.other.name} · ${view.other.role}`],
                  [dict.sign.date, view.other.date],
                  [dict.sign.time, `${view.other.time} (UTC+1)`],
                  [dict.sign.method, methodLabel(view.other.method)],
                ]}
              />
            )}
          </section>
          <section aria-labelledby="titre-envoi" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h5" id="titre-envoi">{a.hrTitle}</h2>
            <TraceList
              label={a.hrTitle}
              rows={[
                [a.channel, a.channelEmail],
                [a.recipient, view.hr.recipient],
                [a.attachment, view.fileName],
                [a.state, view.hr.state],
              ]}
            />
            {view.hr.missing && <p className="small">{a.hrMissingHelp}</p>}
            {view.hr.canSend && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                {view.hr.manual && <p className="small">{a.sendManual}</p>}
                <button className="btn" type="button" disabled={pending} onClick={send}>{a.sendNow}</button>
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
        title={t(a.rejectTitle, { name: view.internName })}
        footer={
          <>
            <button className="btn" type="button" onClick={() => setRejecting(false)}>{dict.form.cancel}</button>
            <button className="btn btn-danger" type="button" disabled={pending} onClick={reject}>{a.rejectConfirm}</button>
          </>
        }
      >
        <p>{a.rejectIntro}</p>
        <div>
          <label className="form-label is-required" htmlFor="motif-renvoi">{a.rejectReason}</label>
          <textarea
            className={reasonError ? "form-control is-invalid" : "form-control"}
            id="motif-renvoi"
            rows={3}
            style={{ height: "auto", padding: 10 }}
            aria-required="true"
            aria-invalid={reasonError || undefined}
            aria-describedby={reasonError ? "motif-renvoi-erreur" : undefined}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(false);
            }}
          />
          {reasonError && <FieldError id="motif-renvoi-erreur">{a.rejectReasonMissing}</FieldError>}
        </div>
      </Modal>
    </main>
  );
}
