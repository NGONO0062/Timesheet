"use client";
// Détail d'une fiche (08-Detail-fiche et prototype 08) : grille en lecture seule,
// commentaire, historique et décision. Le motif n'apparaît et n'est requis que pour
// un rejet ; le manager peut alors signaler des cellules dans la grille (§19).
import Link from "next/link";
import { useId, useState, useTransition, type FormEvent } from "react";
import { decideSheet, type DecideResult } from "@/app/actions/validation";
import { Alert } from "@/components/ods/Display";
import { FieldError } from "@/components/ods/Form";
import { TimeGrid } from "@/components/ts/TimeGrid";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { plural } from "@/lib/validation/queue";
import { TableScroll } from "@/components/ods/TableScroll";

const v = dict.validation;

export type ReviewSheet = {
  id: string;
  pending: boolean;
  caption: string;
  days: string[];
  expected: number[];
  lines: Array<{ id: string; project: string; activity: string; hours: Array<number | null>; flagged: boolean[] }>;
  comment: string | null;
  events: Array<{ id: string; label: string; by: string; at: string }>;
};

const ERRORS: Record<DecideResult["error"], string> = {
  reasonMissing: v.reasonMissing,
  alreadyDecided: v.decideError,
  session: dict.entry.errors.session,
  unknown: v.actionError,
};

export function ReviewPanel({ sheet }: { sheet: ReviewSheet }) {
  const days = sheet.days.map((d) => new Date(d));
  const [decision, setDecision] = useState<"VALIDATE" | "REJECT">("VALIDATE");
  const [motif, setMotif] = useState("");
  const [motifError, setMotifError] = useState(false);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ids = { motif: useId(), help: useId(), err: useId(), flags: useId() };
  const rejecting = sheet.pending && decision === "REJECT";

  function toggleFlag(lineId: string, day: number) {
    setFlags((f) => {
      const n = new Set(f);
      const key = `${lineId}:${day}`;
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (decision === "REJECT" && !motif.trim()) {
      setMotifError(true);
      document.getElementById(ids.motif)?.focus();
      return;
    }
    const payload =
      decision === "VALIDATE"
        ? ({ decision: "VALIDATE" } as const)
        : {
            decision: "REJECT" as const,
            reason: motif,
            flags: [...flags].map((k) => {
              const [lineId, day] = k.split(":");
              return { lineId: lineId!, day: Number(day) };
            }),
          };
    start(async () => {
      const r = await decideSheet(sheet.id, payload);
      if (r && !r.ok) {
        if (r.error === "reasonMissing") setMotifError(true);
        else setError(ERRORS[r.error]);
      }
    });
  }

  return (
    <>
      <section aria-labelledby="titre-grille" className="ts-section">
        <h2 className="h3" id="titre-grille">{v.hoursTitle}</h2>
        {rejecting && <p className="small">{v.flagHelp}</p>}
        <TableScroll>
          <TimeGrid
            caption={sheet.caption}
            days={days}
            expected={sheet.expected}
            step={0.01}
            readOnly
            rows={sheet.lines.map((l) => ({
              id: l.id,
              project: l.project,
              activity: l.activity,
              values: l.hours.map((h) => (h === null ? "" : formatNumber(h))),
              flagged: days.map((_, j) => (sheet.pending ? flags.has(`${l.id}:${j}`) : (l.flagged[j] ?? false))),
            }))}
            onToggleFlag={rejecting ? toggleFlag : undefined}
          />
        </TableScroll>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 30 }}>
          <section aria-labelledby="titre-commentaire" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h5" id="titre-commentaire">{v.commentTitle}</h2>
            {sheet.comment ? <p style={{ whiteSpace: "pre-line" }}>{sheet.comment}</p> : <p className="text-secondary">{v.noComment}</p>}
          </section>
          <section aria-labelledby="titre-histo" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h5" id="titre-histo">{v.historyTitle}</h2>
            <ul className="list-group">
              {sheet.events.map((ev) => (
                <li className="list-group-item" key={ev.id}>
                  <span>
                    <span className="fw-bold">{ev.label}</span>
                    {ev.by && ` ${ev.by}`}
                  </span>
                  <span className="small text-secondary">{ev.at}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {sheet.pending ? (
          <form className="card card-strong" style={{ flex: "1 1 380px", minWidth: 0 }} onSubmit={submit} noValidate>
            <fieldset style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0, border: 0, minWidth: 0 }}>
              <legend className="h3" style={{ padding: 0, marginBottom: 20 }}>{v.decision}</legend>
              {(["VALIDATE", "REJECT"] as const).map((d) => (
                <div className="form-check" key={d}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="decision"
                    id={`decision-${d}`}
                    checked={decision === d}
                    onChange={() => {
                      setDecision(d);
                      setError(null);
                    }}
                  />
                  <label htmlFor={`decision-${d}`} className={cx(decision === d && "fw-bold")}>
                    {d === "VALIDATE" ? v.validate : v.reject}
                  </label>
                </div>
              ))}
            </fieldset>
            {rejecting && (
              <div>
                <label className="form-label is-required" htmlFor={ids.motif}>{v.reason}</label>
                <textarea
                  className={cx("form-control", motifError && "is-invalid")}
                  id={ids.motif}
                  rows={4}
                  aria-required="true"
                  aria-invalid={motifError || undefined}
                  aria-describedby={cx(ids.help, ids.flags, motifError && ids.err)}
                  value={motif}
                  onChange={(e) => {
                    setMotif(e.target.value);
                    if (e.target.value.trim()) setMotifError(false);
                  }}
                />
                <p className="form-text" id={ids.help}>{v.reasonHelp}</p>
                {motifError && <FieldError id={ids.err}>{v.reasonMissing}</FieldError>}
                <p className="small" id={ids.flags} role="status" style={{ marginTop: 10 }}>
                  {flags.size === 0 ? v.flaggedNone : plural(flags.size, v.flaggedOne, v.flaggedMany)}
                </p>
              </div>
            )}
            {error && (
              <Alert tone="danger" role="alert">
                <p>{error}</p>
              </Alert>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 }}>
              <Link className="btn" href="/validation">{dict.form.cancel}</Link>
              <button className={cx("btn", rejecting ? "btn-danger" : "btn-primary")} type="submit" disabled={pending}>
                {rejecting ? v.reject : v.validate}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <Alert tone="info">
              <p>{v.notPending}</p>
            </Alert>
          </div>
        )}
      </div>
    </>
  );
}
