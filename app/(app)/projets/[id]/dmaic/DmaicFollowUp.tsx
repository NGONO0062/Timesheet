"use client";
// Suivi d'un projet DMAIC (PROMPT.md §9.4, lot 3). Livrables cochés tout de suite, avec
// « Annuler » ; indicateur par un formulaire ; revue de passage demandée par qui gère le
// projet, décidée par le sponsor. Un seul bouton primaire : la demande ou la décision.
import Link from "next/link";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { askTollgate, decideProjectTollgate, saveProjectIndicator, toggleDeliverable, type DmaicActionError } from "@/app/actions/dmaic";
import { Alert, Progress } from "@/components/ods/Display";
import { Checkbox, FieldError, TextareaField, TextField } from "@/components/ods/Form";
import { Mark } from "@/components/ods/Icon";
import { Breadcrumb, SteppedProcess } from "@/components/ods/Navigation";
import { EmptyState } from "@/components/ts/States";
import { cx } from "@/lib/cx";
import { dict, t } from "@/lib/i18n";
import { DELIVERABLES, deliverableLabel, deliverableProgress, type DeliverableKey } from "@/lib/projects/deliverables";
import { DMAIC_PHASES, phaseLabel, phaseStepText, type DmaicPhase } from "@/lib/projects/dmaic";
import { checkIndicator, indicatorForm, indicatorProgress, indicatorTexts, type Indicator, type IndicatorErrors, type IndicatorInput } from "@/lib/projects/indicator";
import { latestTollgate, phaseAfterApproval, requestRefusal, type TollgateStatus } from "@/lib/projects/tollgate";

const d = dict.dmaic;

export type TollgateItem = {
  id: string;
  phase: DmaicPhase;
  status: TollgateStatus;
  requestedAt: string;
  requestedOn: string;
  requestedBy: string | null;
  note: string | null;
  decidedOn: string | null;
  decidedBy: string | null;
  comment: string | null;
};

export type FollowUpProject = {
  id: string;
  code: string;
  name: string;
  kind: "STANDARD" | "DMAIC";
  phase: DmaicPhase | null;
  archived: boolean;
  sponsor: { id: string; name: string } | null;
  canManage: boolean;
  isSponsor: boolean;
  done: DeliverableKey[];
  indicator: Indicator | null;
  tollgates: TollgateItem[];
};

type Notice = { text: string; undo?: () => void };

const ERRORS: Record<DmaicActionError, string> = {
  notManaged: d.errors.notManaged,
  notSponsor: d.errors.notSponsor,
  noSponsor: d.errors.noSponsor,
  alreadyRequested: d.errors.alreadyRequested,
  alreadyApproved: d.errors.alreadyApproved,
  notRequested: d.errors.notRequested,
  archived: d.errors.archived,
  commentMissing: d.commentMissing,
  notFound: dict.project.errors.notFound,
  notDmaic: dict.project.errors.notDmaic,
  session: dict.entry.errors.session,
  unknown: d.actionError,
};

export function DmaicFollowUp({ project }: { project: FollowUpProject }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const head = (
    <>
      <Breadcrumb items={[{ label: d.breadcrumb, href: "/projets" }, { label: project.name }]} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1>{project.name}</h1>
        <p className="text-secondary">{t(d.subtitle, { code: project.code })}</p>
      </div>
    </>
  );

  if (project.kind !== "DMAIC" || project.phase === null) {
    return (
      <main className="container ts-stack">
        {head}
        <EmptyState title={d.notDmaicTitle} headingLevel={2} actions={<Link className="btn" href={`/projets?projet=${project.id}`}>{d.backToProjects}</Link>}>
          {d.notDmaicText}
        </EmptyState>
      </main>
    );
  }

  const phase = project.phase;
  const editable = project.canManage && !project.archived;

  return (
    <main className="container ts-stack">
      {head}
      {project.archived && (
        <Alert tone="info">
          <p>{d.archivedNote}</p>
        </Alert>
      )}
      {!project.archived && !project.canManage && project.isSponsor && (
        <Alert tone="info">
          <p>{d.readOnlyNote}</p>
        </Alert>
      )}
      {notice && (
        <Alert
          tone="success"
          role="status"
          onClose={() => setNotice(null)}
          action={notice.undo ? <button className="btn btn-link" type="button" onClick={() => { const u = notice.undo; setNotice(null); u?.(); }}>{dict.form.undo}</button> : undefined}
        >
          <p>{notice.text}</p>
        </Alert>
      )}
      {error && (
        <Alert tone="danger" role="alert" onClose={() => setError(null)}>
          <p>{error}</p>
        </Alert>
      )}

      <section className="ts-section" aria-labelledby="titre-phase">
        <h2 className="h3" id="titre-phase">{d.phaseTitle}</h2>
        <SteppedProcess steps={DMAIC_PHASES.map(phaseLabel)} current={DMAIC_PHASES.indexOf(phase)} label={dict.project.phaseStepsLabel} />
        <p className="fw-bold">{phaseStepText(phase)}</p>
        <p>{project.sponsor ? t(d.sponsorLine, { name: project.sponsor.name }) : d.sponsorNone}</p>
      </section>

      <TollgateSection project={project} phase={phase} editable={editable} onNotice={setNotice} onError={setError} />
      <DeliverablesSection project={project} phase={phase} editable={editable} onNotice={setNotice} onError={setError} />
      <IndicatorSection project={project} editable={editable} onNotice={setNotice} onError={setError} />
    </main>
  );
}

type SectionProps = {
  project: FollowUpProject;
  editable: boolean;
  onNotice: (n: Notice | null) => void;
  onError: (e: string | null) => void;
};

/** État de la revue de la phase en cours, en une phrase, avec son repère. */
function tollgateState(project: FollowUpProject, phase: DmaicPhase): { tone: "info" | "warning" | "success" | null; text: string } {
  const latest = latestTollgate(project.tollgates.map((g) => ({ ...g, requestedAt: new Date(g.requestedAt) })), phase);
  if (!latest) return { tone: null, text: t(d.tollgateNone, { phase: phaseLabel(phase) }) };
  const name = (s: string | null) => s ?? "—";
  if (latest.status === "REQUESTED") {
    return { tone: "info", text: t(d.tollgateRequested, { date: latest.requestedOn, name: name(latest.requestedBy), sponsor: project.sponsor?.name ?? "—" }) };
  }
  if (latest.status === "CHANGES_REQUESTED") {
    return { tone: "warning", text: t(d.tollgateChanges, { date: latest.decidedOn ?? "", name: name(latest.decidedBy), comment: latest.comment ?? "" }) };
  }
  return { tone: "success", text: t(phase === "CONTROL" ? d.tollgateClosed : d.tollgateApproved, { date: latest.decidedOn ?? "", name: name(latest.decidedBy) }) };
}

function TollgateSection({ project, phase, editable, onNotice, onError }: SectionProps & { phase: DmaicPhase }) {
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<"APPROVE" | "CHANGES">("APPROVE");
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState(false);
  const [pending, start] = useTransition();
  const records = project.tollgates.map((g) => ({ ...g, requestedAt: new Date(g.requestedAt) }));
  const latest = latestTollgate(records, phase);
  const state = tollgateState(project, phase);
  const progress = deliverableProgress(phase, new Set(project.done));
  const canRequest = editable && requestRefusal(project.sponsor !== null, records, phase) === null;
  const canDecide = project.isSponsor && !project.archived && latest?.status === "REQUESTED";
  const next = phaseAfterApproval(phase);

  function request(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onError(null);
    start(async () => {
      const r = await askTollgate(project.id, note);
      if (!r.ok) return onError(ERRORS[r.error]);
      setNote("");
      onNotice({ text: t(d.requested, { phase: phaseLabel(r.phase), sponsor: r.sponsor }) });
    });
  }

  function decide(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onError(null);
    if (decision === "CHANGES" && !comment.trim()) {
      setCommentError(true);
      document.getElementById("revue-commentaire")?.focus();
      return;
    }
    start(async () => {
      const r = await decideProjectTollgate(project.id, decision, comment);
      if (!r.ok) {
        if (r.error === "commentMissing") return setCommentError(true);
        return onError(ERRORS[r.error]);
      }
      // Prochaine revue : le formulaire repart de « Accorder le passage ».
      setComment("");
      setDecision("APPROVE");
      onNotice({
        text: !r.approved
          ? t(d.changesNotice, { name: r.requester ?? "—" })
          : r.next
            ? t(d.approvedNotice, { name: r.name, phase: phaseLabel(r.next) })
            : t(d.closedNotice, { name: r.name }),
      });
    });
  }

  const history = [...project.tollgates].reverse();

  return (
    <section className="ts-section" aria-labelledby="titre-revue">
      <h2 className="h3" id="titre-revue">{d.tollgateTitle}</h2>
      {project.sponsor === null ? (
        <p>{d.sponsorNoneText}</p>
      ) : (
        <>
          <p>{t(d.tollgateIntro, { phase: phaseLabel(phase) })}{phase === "CONTROL" && ` ${d.tollgateLast}`}</p>
          <p className="fw-bold" style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
            {state.tone && <Mark tone={state.tone} />}
            <span>{state.text}</span>
          </p>
          <p>{t(d.deliverablesOf, { done: progress.done, total: progress.total })}</p>
        </>
      )}

      {canRequest && (
        <form className="card" style={{ maxWidth: 590 }} onSubmit={request} noValidate>
          <TextareaField id="revue-message" label={d.note} hint={d.noteHint} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          <div>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {latest?.status === "CHANGES_REQUESTED" ? d.requestAgain : d.request}
            </button>
          </div>
        </form>
      )}

      {canDecide && (
        <form className="card card-strong" style={{ maxWidth: 590 }} onSubmit={decide} noValidate>
          <fieldset style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0, border: 0, minWidth: 0 }}>
            <legend className="h4" style={{ padding: 0, marginBottom: 10 }}>{d.decision}</legend>
            {latest?.note && <p>{t(dict.mail.tollgateNote, { note: latest.note })}</p>}
            {(["APPROVE", "CHANGES"] as const).map((x) => (
              <div className="form-check" key={x}>
                <input
                  className="form-check-input"
                  type="radio"
                  name="revue-decision"
                  id={`revue-${x}`}
                  checked={decision === x}
                  aria-describedby={x === "APPROVE" && next ? "revue-APPROVE-aide" : undefined}
                  onChange={() => {
                    setDecision(x);
                    setCommentError(false);
                  }}
                />
                <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label htmlFor={`revue-${x}`} className={cx(decision === x && "fw-bold")}>
                    {x === "CHANGES" ? d.changes : next ? d.approve : d.approveLast}
                  </label>
                  {x === "APPROVE" && next && (
                    <span className="form-text" id="revue-APPROVE-aide" style={{ marginTop: 0 }}>{t(d.approveHint, { phase: phaseLabel(next) })}</span>
                  )}
                </span>
              </div>
            ))}
          </fieldset>
          {decision === "CHANGES" && (
            <div>
              <label className="form-label is-required" htmlFor="revue-commentaire">{d.comment}</label>
              <textarea
                className={cx("form-control", commentError && "is-invalid")}
                id="revue-commentaire"
                rows={4}
                maxLength={2000}
                aria-required="true"
                aria-invalid={commentError || undefined}
                aria-describedby={cx("revue-commentaire-aide", commentError && "revue-commentaire-erreur")}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (e.target.value.trim()) setCommentError(false);
                }}
              />
              <p className="form-text" id="revue-commentaire-aide">{t(d.commentHint, { name: latest?.requestedBy ?? "—" })}</p>
              {commentError && <FieldError id="revue-commentaire-erreur">{d.commentMissing}</FieldError>}
            </div>
          )}
          <div>
            <button className="btn btn-primary" type="submit" disabled={pending}>{d.saveDecision}</button>
          </div>
        </form>
      )}

      {history.length > 0 && (
        <>
          <h3 className="h5">{d.historyTitle}</h3>
          <div className="table-responsive">
            <table className="table">
              <caption className="visually-hidden">{d.historyCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{d.colPhase}</th>
                  <th scope="col">{d.colRequest}</th>
                  <th scope="col">{d.colDecision}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((g) => (
                  <tr key={g.id}>
                    <th scope="row">{phaseLabel(g.phase)}</th>
                    <td>{t(d.historyRequest, { name: g.requestedBy ?? "—", date: g.requestedOn })}</td>
                    <td>
                      {g.status === "REQUESTED"
                        ? d.historyPending
                        : t(g.status === "APPROVED" ? d.historyApproved : d.historyChanges, { name: g.decidedBy ?? "—", date: g.decidedOn ?? "", comment: g.comment ?? "" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function DeliverablesSection({ project, phase, editable, onNotice, onError }: SectionProps & { phase: DmaicPhase }) {
  const [, start] = useTransition();
  // Coche affichée tout de suite ; elle revient aux données du serveur à la fin de l'action.
  const [done, show] = useOptimistic(new Set<string>(project.done), (set, op: { key: DeliverableKey; done: boolean }) => {
    const next = new Set(set);
    if (op.done) next.add(op.key);
    else next.delete(op.key);
    return next;
  });

  function toggle(key: DeliverableKey, value: boolean) {
    onError(null);
    start(async () => {
      show({ key, done: value });
      const r = await toggleDeliverable(project.id, key, value);
      if (!r.ok) return onError(ERRORS[r.error]);
      const name = deliverableLabel(key);
      onNotice({
        text: t(value ? d.deliverableDone : d.deliverableUndone, { name }),
        undo: () =>
          start(async () => {
            show({ key, done: !value });
            const back = await toggleDeliverable(project.id, key, !value);
            if (back.ok) onNotice({ text: dict.project.undone });
            else onError(ERRORS[back.error]);
          }),
      });
    });
  }

  return (
    <section className="ts-section" aria-labelledby="titre-livrables">
      <h2 className="h3" id="titre-livrables">{d.deliverablesTitle}</h2>
      <p>{d.deliverablesIntro}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 20 }}>
        {DMAIC_PHASES.map((ph) => {
          const p = deliverableProgress(ph, done);
          return (
            <fieldset key={ph} className={cx("card", ph === phase && "card-strong")} style={{ margin: 0, minWidth: 0 }}>
              <legend className="h6" style={{ float: "left", width: "100%", padding: 0, margin: 0 }}>
                {t(d.deliverablesLegend, { phase: phaseLabel(ph), done: p.done, total: p.total })}
                {ph === phase && <span className="small" style={{ fontWeight: 400 }}> · {d.deliverablesCurrent}</span>}
              </legend>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, clear: "both" }}>
                {DELIVERABLES[ph].map((key) =>
                  editable ? (
                    <Checkbox key={key} id={`livrable-${key}`} label={deliverableLabel(key)} checked={done.has(key)} onChange={(e) => toggle(key, e.target.checked)} />
                  ) : (
                    <p key={key} style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                      {done.has(key) ? <Mark tone="success" /> : <span aria-hidden="true" style={{ width: 20, flex: "none" }} />}
                      <span>
                        {deliverableLabel(key)}
                        <span className="visually-hidden">{done.has(key) ? ` : ${dict.dmaic.deliverableDoneShort}` : ` : ${dict.dmaic.deliverableTodoShort}`}</span>
                      </span>
                    </p>
                  ),
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

function IndicatorSection({ project, editable, onNotice, onError }: SectionProps) {
  const [form, setForm] = useState<IndicatorInput>(() => indicatorForm(project.indicator));
  const [errors, setErrors] = useState<IndicatorErrors>({});
  const [pending, start] = useTransition();
  const set = (k: keyof IndicatorInput, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const i = project.indicator;
  const texts = i ? indicatorTexts(i) : null;
  const progress = i ? indicatorProgress(i) : null;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onError(null);
    const checked = checkIndicator(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      const first = (["name", "baseline", "target", "current"] as const).find((k) => checked.errors[k]);
      document.getElementById(`indicateur-${first}`)?.focus();
      return;
    }
    setErrors({});
    start(async () => {
      const r = await saveProjectIndicator(project.id, form);
      if (r.ok) return onNotice({ text: r.cleared ? d.indicatorCleared : d.indicatorSaved });
      if ("fields" in r) return setErrors(r.fields);
      onError(ERRORS[r.error]);
    });
  }

  return (
    <section className="ts-section" aria-labelledby="titre-indicateur">
      <h2 className="h3" id="titre-indicateur">{d.indicatorTitle}</h2>
      <p>{d.indicatorIntro}</p>
      {i && texts ? (
        <div className="card" style={{ maxWidth: 590 }}>
          <h3 className="h5">{i.name}</h3>
          <p>{texts.goal}</p>
          <p className="fw-bold">{texts.facts}</p>
          {progress && (
            <>
              <Progress value={progress.ratio * 100} label={t(d.indicatorBar, { name: i.name })} tone={progress.reached ? "success" : undefined} />
              <p className="small fw-bold" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {progress.reached && <Mark tone="success" />}
                {progress.wrongWay && <Mark tone="warning" />}
                {texts.progress}
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="text-secondary">{d.indicatorNone}</p>
      )}

      {editable && (
        <form className="card" style={{ maxWidth: 590 }} onSubmit={submit} noValidate>
          <p className="small text-secondary">{dict.form.requiredLegend} {d.indicatorClearHint}</p>
          <TextField id="indicateur-name" label={d.indicatorName} required maxLength={200} value={form.name} error={errors.name} onChange={(e) => set("name", e.target.value)} />
          <TextField id="indicateur-unit" label={d.indicatorUnit} hint={d.indicatorUnitHint} maxLength={40} value={form.unit} onChange={(e) => set("unit", e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 20 }}>
            <TextField id="indicateur-baseline" label={d.indicatorBaseline} required inputMode="decimal" maxLength={30} value={form.baseline} error={errors.baseline} onChange={(e) => set("baseline", e.target.value)} />
            <TextField id="indicateur-target" label={d.indicatorTarget} required inputMode="decimal" maxLength={30} value={form.target} error={errors.target} onChange={(e) => set("target", e.target.value)} />
            <TextField id="indicateur-current" label={d.indicatorCurrent} hint={d.indicatorCurrentHint} inputMode="decimal" maxLength={30} value={form.current} error={errors.current} onChange={(e) => set("current", e.target.value)} />
          </div>
          <p className="form-text" style={{ marginTop: 0 }}>{d.indicatorNumberHint}</p>
          <div>
            <button className="btn" type="submit" disabled={pending}>{d.indicatorSave}</button>
          </div>
        </form>
      )}
    </section>
  );
}
