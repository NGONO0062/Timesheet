"use client";
// Écran 3 (03-Saisie-hebdo, 03-Saisie-hebdo-mobile), écran 4 (04-Confirmation) et
// écran 5 (05-Fiche-rejetee). Desktop : la grille de la semaine. Sous 768 px : un
// jour à la fois. Les deux vues partagent le même état et la même sauvegarde.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { saveWeekDraft, submitWeekEntry, type DraftPayload, type EntryActionError } from "@/app/actions/timesheet";
import { Alert, Badge, Progress, type Tone } from "@/components/ods/Display";
import { Dropdown } from "@/components/ods/Dropdown";
import { FieldError, QuantitySelector } from "@/components/ods/Form";
import { Icon } from "@/components/ods/Icon";
import { Breadcrumb } from "@/components/ods/Navigation";
import { Modal } from "@/components/ods/Overlay";
import { EmptyState, SaveIndicator, type SaveState } from "@/components/ts/States";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { TimeGrid } from "@/components/ts/TimeGrid";
import { WeekSelector } from "@/components/ts/WeekSelector";
import { cx } from "@/lib/cx";
import { capitalize, formatFromTo, formatHours, formatHoursOf, formatNumber, formatRange, formatTime, formatWeekdayDay } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { isoWeekday, type IsoWeek } from "@/lib/iso-week";
import { entryHref } from "@/lib/routes";
import { lineKey } from "@/lib/timesheet/draft";
import { dayStatus, dayTotals, parseHours, submitCheck, sum, type DayStatus } from "@/lib/timesheet/rules";
import type { EntryLine, EntryView } from "./view";
import { TableScroll } from "@/components/ods/TableScroll";

const e = dict.entry;
const AUTOSAVE_DELAY_MS = 1000;
const FLAG_ANCHOR = "cellule-signalee";
const FLAG_ANCHOR_MOBILE = "cellule-signalee-mobile";

type Row = EntryLine & { id: string; values: string[] };
type Save = { state: SaveState; time?: string; message?: string };
type LineChoice = EntryView["eligible"][number];

const toRow = (l: EntryLine): Row => ({ ...l, id: lineKey(l), values: l.hours.map((h) => (h === null ? "" : formatNumber(h))) });

const DAY_TONE: Record<DayStatus, Tone | undefined> = {
  UPCOMING: undefined,
  TODO: "warning",
  PARTIAL: "warning",
  COMPLETE: "success",
  OVER: "danger",
  TO_FIX: "danger",
};

function errorText(code: EntryActionError, step: number): string {
  if (code === "invalidHours") return t(e.errors.invalidHours, { step: formatHours(step) });
  return e.errors[code];
}

export function WeekEntry({ view }: { view: EntryView }) {
  const router = useRouter();
  const days = view.days.map((d) => new Date(d));
  const { step, editable } = view;

  // Semaine vide et préférence active : les lignes de la semaine précédente, sans les heures.
  // Rien n'est enregistré tant que la saisie ne commence pas.
  const [rows, setRows] = useState<Row[]>(() =>
    view.autoCopy ? view.previous.map((c) => toRow({ ...c, locked: false, hours: days.map(() => null), flagged: days.map(() => false) })) : view.lines.map(toRow),
  );
  const [comment, setComment] = useState(view.comment);
  const [save, setSave] = useState<Save>(() =>
    view.rejected ? { state: "info", message: e.reopened } : view.savedTime ? { state: "saved", time: view.savedTime } : { state: "idle" },
  );
  const [removed, setRemoved] = useState<{ row: Row; index: number } | null>(null);
  const [day, setDay] = useState(() => initialDay(view));
  const [modal, setModal] = useState(false);
  const [submitError, setSubmitError] = useState<EntryActionError | null>(null);
  const [submitting, startSubmit] = useTransition();

  // --- Sauvegarde automatique ----------------------------------------------------
  // `pending` garde la dernière saisie non enregistrée ; une seule requête à la fois.
  const pending = useRef<{ rows: Row[]; comment: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef<Promise<boolean> | null>(null);

  const payloadOf = (r: Row[], c: string) => buildPayload(r, c, view.week, step);

  async function flush(): Promise<boolean> {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    while (running.current) await running.current;
    const snapshot = pending.current;
    if (!snapshot) return true;
    pending.current = null;
    const payload = payloadOf(snapshot.rows, snapshot.comment);
    if (!payload) {
      // Une cellule refusée : rien ne part tant qu'elle n'est pas corrigée (message sous la grille).
      setSave({ state: "failed" });
      return false;
    }
    const job = saveWeekDraft(payload).then(
      (r) => {
        if (r.ok) setSave({ state: "saved", time: formatTime(new Date(r.savedAt)) });
        else setSave({ state: "failed", message: errorText(r.error, step) });
        return r.ok;
      },
      () => {
        setSave({ state: "failed", message: e.errors.unknown });
        return false;
      },
    );
    running.current = job;
    const ok = await job;
    running.current = null;
    // Échec : la saisie reste à l'écran et repartira à la prochaine modification.
    if (!ok && !pending.current) pending.current = snapshot;
    return ok;
  }

  function commit(nextRows: Row[], nextComment: string) {
    setRows(nextRows);
    setComment(nextComment);
    pending.current = { rows: nextRows, comment: nextComment };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }

  // En quittant l'écran (lien, menu), la dernière frappe part quand même.
  useEffect(() => {
    const ref = pending;
    const timerRef = timer;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const snapshot = ref.current;
      if (snapshot) {
        const payload = buildPayload(snapshot.rows, snapshot.comment, view.week, step);
        if (payload) void saveWeekDraft(payload);
      }
    };
  }, [view.week, step]);

  // --- Modifications ---------------------------------------------------------------
  const setCell = (rowId: string, j: number, raw: string) =>
    commit(rows.map((r) => (r.id === rowId ? { ...r, values: r.values.map((v, k) => (k === j ? raw : v)) } : r)), comment);

  function removeLine(rowId: string) {
    const index = rows.findIndex((r) => r.id === rowId);
    const row = rows[index];
    if (!row) return;
    commit(rows.filter((r) => r.id !== rowId), comment);
    setRemoved({ row, index });
  }

  function undoRemove() {
    if (!removed) return;
    const next = [...rows];
    next.splice(Math.min(removed.index, next.length), 0, removed.row);
    commit(next, comment);
    setRemoved(null);
  }

  function addLines(choices: LineChoice[]) {
    const present = new Set(rows.map((r) => r.id));
    const added = choices
      .filter((c) => !present.has(lineKey(c)))
      .map((c) => toRow({ ...c, locked: false, hours: days.map(() => null), flagged: days.map(() => false) }));
    if (added.length) commit([...rows, ...added], comment);
  }

  async function navigate(w: IsoWeek) {
    await flush();
    router.push(entryHref(w));
  }

  async function openSubmit() {
    await flush();
    setSubmitError(null);
    setModal(true);
  }

  function confirmSubmit() {
    const payload = payloadOf(rows, comment);
    if (!payload) return;
    setSubmitError(null);
    pending.current = null;
    startSubmit(async () => {
      const r = await submitWeekEntry(payload);
      if (r && !r.ok) setSubmitError(r.error);
    });
  }

  // --- Calculs ---------------------------------------------------------------------
  const numbers = rows.map((r) => r.values.map((v) => {
    const p = parseHours(v, step);
    return p.kind === "ok" ? p.value : 0;
  }));
  const totals = dayTotals(numbers, days.length);
  const total = sum(totals);
  const expectedTotal = sum(view.expected);
  const stillFlagged = (r: Row, j: number) => {
    if (!r.flagged[j]) return false;
    const p = parseHours(r.values[j] ?? "", step);
    return p.kind === "ok" ? p.value === r.hours[j] : p.kind === "empty" && r.hours[j] === null;
  };
  const flaggedCells = rows.flatMap((r, i) => days.map((_, j) => (stillFlagged(r, j) ? { i, j } : null))).filter((x) => x !== null);
  const invalid = rows.some((r) => !r.locked && r.values.some((v) => parseHours(v, step).kind === "invalid"));
  const check = submitCheck(days, totals, view.expected);
  const canSubmit = editable && Boolean(view.validator) && !invalid && check.canSubmit && rows.length > 0;
  const reason = !view.validator
    ? e.noValidator
    : invalid
      ? t(dict.grid.invalidNumber, { step: formatHours(step) })
      : check.canSubmit && view.rejected && flaggedCells.length > 0
        ? t(e.resubmitHint, { name: view.validator.name })
        : check.message;
  const submitLabel = view.rejected ? dict.grid.resubmit : dict.grid.submit;
  const available = view.eligible.filter((c) => !rows.some((r) => r.id === lineKey(c)));
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const period = formatFromTo(first, last);
  const caption =
    t(editable ? e.caption : e.captionReadonly, { week: view.week.week, period: period.charAt(0).toLowerCase() + period.slice(1) }) +
    (editable && flaggedCells.length === 1 ? e.captionFlaggedOne : "") +
    (editable && flaggedCells.length > 1 ? t(e.captionFlaggedMany, { n: flaggedCells.length }) : "");
  const statuses = days.map((_, j) =>
    dayStatus({ total: totals[j]!, expected: view.expected[j]!, flagged: rows.some((r) => stillFlagged(r, j)) }),
  );

  function goToFlagged(ev: MouseEvent<HTMLAnchorElement>) {
    const cell = flaggedCells[0];
    if (!cell) return;
    ev.preventDefault();
    if (window.matchMedia("(max-width: 767.98px)").matches) {
      setDay(cell.j);
      requestAnimationFrame(() => document.getElementById(FLAG_ANCHOR_MOBILE)?.focus());
    } else {
      document.getElementById(FLAG_ANCHOR)?.focus();
    }
  }

  function nextDay() {
    setDay((d) => Math.min(d + 1, days.length - 1));
    requestAnimationFrame(() => document.getElementById("titre-jour")?.focus());
  }

  const addLine = (variant: "grid" | "empty" | "mobile") => (
    <AddLine
      available={available}
      none={view.eligible.length === 0}
      label={variant === "mobile" ? e.addProject : dict.grid.addLine}
      primary={variant === "empty"}
      block={variant === "mobile"}
      reasonId={`raison-ajout-${variant}`}
      onAdd={(c) => addLines([c])}
    />
  );

  const selectorProps = { week: view.week, current: view.current, allowFutureWeeks: view.allowFutureWeeks, recent: view.recent, onNavigate: (w: IsoWeek) => void navigate(w) };
  const history = view.events.length > 0 && (
    <section aria-labelledby="titre-histo" className="ts-history">
      <h2 className="h6" id="titre-histo">{e.historyTitle}</h2>
      <ul className="list-group">
        {view.events.map((ev) => (
          <li className="list-group-item" key={ev.id}>
            <span>
              <span className="fw-bold">{ev.label}</span> {ev.by}
            </span>
            <span className="small text-secondary">{ev.at}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="container ts-stack">
      <div className="ts-section">
        <div className="ts-wide">
          <Breadcrumb items={[{ label: dict.dashboard.title, href: "/tableau-de-bord" }, { label: e.title }]} />
        </div>
        <div className="ts-head">
          <h1>
            <span className="ts-wide">{e.title}</span>
            <span className="ts-narrow">{e.titleShort}</span>
          </h1>
          <StatusBadge kind="timesheet" value={view.status} />
        </div>
      </div>

      {view.rejection && editable && (
        <Alert tone="danger" role="alert" heading={t(e.rejectedHeading, { name: view.rejection.by })}>
          <p className="small text-secondary">{view.rejection.at}</p>
          {view.rejection.reason && <p>{t(e.rejectedReason, { reason: view.rejection.reason })}</p>}
          {flaggedCells.length > 0 && (
            <p>
              <a href={`#${FLAG_ANCHOR}`} onClick={goToFlagged}>
                {e.goToFlagged}
              </a>
            </p>
          )}
        </Alert>
      )}

      {view.justSubmitted && view.validator ? (
        <Alert tone="success" role="status" heading={t(e.justSubmittedTitle, { week: view.week.week })}>
          <p>{t(e.justSubmittedText, { name: view.validator.name })}</p>
          <p>
            <Link href="/tableau-de-bord">{e.backToDashboard}</Link>
          </p>
        </Alert>
      ) : (
        view.info && (
          <Alert tone={view.info.tone}>
            <p>{view.info.text}</p>
          </Alert>
        )
      )}

      <div className="ts-head ts-wide">
        <WeekSelector {...selectorProps} />
        {editable && <SaveIndicator {...save} />}
      </div>
      <div className="ts-narrow">
        <WeekSelector {...selectorProps} large />
      </div>

      {view.futureBlocked ? (
        <Alert tone="info" heading={e.futureTitle} action={<Link className="btn" href={entryHref(view.current)}>{e.goToCurrent}</Link>}>
          <p>{e.futureText}</p>
        </Alert>
      ) : (
        <>
          <section aria-label={e.gridLabel} className="ts-section ts-wide">
            {editable && rows.length > 0 && (
              <p className="small text-secondary">{t(e.rule, { hours: formatHours(view.hoursPerDay), step: formatHours(step) })}</p>
            )}
            <TableScroll>
              <TimeGrid
                caption={caption}
                days={days}
                expected={view.expected}
                rows={rows.map((r) => ({ id: r.id, project: r.project, activity: r.activity, values: r.values, locked: r.locked, flagged: days.map((_, j) => stillFlagged(r, j)) }))}
                step={step}
                readOnly={!editable}
                onChange={setCell}
                onRemove={removeLine}
                flaggedAnchor={FLAG_ANCHOR}
              />
            </TableScroll>
            {removed && (
              <Alert tone="success" role="status" action={<button className="btn btn-link" type="button" onClick={undoRemove}>{dict.form.undo}</button>}>
                <p>{t(e.lineRemoved, { line: `${removed.row.project} · ${removed.row.activity}` })}</p>
              </Alert>
            )}
            {editable && rows.length > 0 && <div>{addLine("grid")}</div>}
          </section>

          {editable && rows.length === 0 && (
            <EmptyState
              title={dict.grid.emptyTitle}
              actions={
                <>
                  {addLine("empty")}
                  <button
                    className="btn"
                    type="button"
                    disabled={view.previous.length === 0}
                    aria-describedby={view.previous.length === 0 ? "raison-reprise" : undefined}
                    onClick={() => addLines(view.previous)}
                  >
                    {t(dict.grid.copyPrevious, { week: view.previousWeek })}
                  </button>
                </>
              }
            >
              {dict.grid.emptyText}
              {view.previous.length === 0 && (
                <span className="small" id="raison-reprise" style={{ display: "block", marginTop: 10 }}>
                  {t(e.nothingToCopy, { week: view.previousWeek })}
                </span>
              )}
            </EmptyState>
          )}

          {rows.length > 0 && (
            <div className="ts-narrow ts-section">
              <ul className="nav nav-pills ts-day-pills" aria-label={e.days}>
                {days.map((d, j) => (
                  <li key={d.toISOString()}>
                    <button className={cx("nav-link", j === day && "active")} type="button" aria-pressed={j === day} onClick={() => setDay(j)}>
                      <span>{`${dict.weekdaysShort[isoWeekday(d)]} ${d.getUTCDate()}`}</span>
                      <span className="small" style={{ fontWeight: 400 }}>
                        {formatHours(totals[j]!)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <section aria-labelledby="titre-jour" className="ts-section">
                <div className="ts-head" style={{ gap: 10 }}>
                  <h2 className="h4" id="titre-jour" tabIndex={-1}>
                    {`${capitalize(formatWeekdayDay(days[day]!))} ${dict.months[days[day]!.getUTCMonth()]}`}
                  </h2>
                  <Badge tone={DAY_TONE[statuses[day]!]}>{formatHoursOf(totals[day]!, view.expected[day]!)}</Badge>
                </div>
                <ul className="list-group">
                  {rows.map((r, i) => {
                    const flagged = editable && stillFlagged(r, day);
                    const isFirstFlag = flagged && flaggedCells[0]?.i === i && flaggedCells[0]?.j === day;
                    const bad = parseHours(r.values[day] ?? "", step).kind === "invalid";
                    const inputId = isFirstFlag ? FLAG_ANCHOR_MOBILE : `jour-${i}`;
                    const label = (
                      <>
                        <span className="fw-bold">{r.project}</span>{" "}
                        <span className="small text-secondary">{r.locked && editable ? t(dict.grid.entryClosed, { activity: r.activity }) : r.activity}</span>
                      </>
                    );
                    return (
                      <li className="list-group-item ts-day-line" key={r.id}>
                        {editable && !r.locked ? (
                          <>
                            <label htmlFor={inputId}>{label}</label>
                            <QuantitySelector
                              id={inputId}
                              size="lg"
                              value={r.values[day] === "" ? "0" : (r.values[day] ?? "0")}
                              onChange={(v) => setCell(r.id, day, v)}
                              step={step}
                              decreaseLabel={t(e.decrease, { step: formatHours(step) })}
                              increaseLabel={t(e.increase, { step: formatHours(step) })}
                              invalid={flagged || bad}
                              aria-describedby={flagged ? `signal-${i}` : undefined}
                            />
                            <span className="small text-secondary">{e.hours}</span>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: "1 1 100%", display: "flex", flexDirection: "column", gap: 5 }}>{label}</span>
                            <span className="fw-bold">{formatHours(numbers[i]![day]!)}</span>
                          </>
                        )}
                        {flagged && (
                          <FieldError id={`signal-${i}`}>
                            {t(dict.grid.flagged, {
                              day: `${capitalize(formatWeekdayDay(days[day]!))} ${dict.months[days[day]!.getUTCMonth()]}`,
                              project: r.project,
                              hours: formatHours(numbers[i]![day]!),
                            })}
                          </FieldError>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {editable && addLine("mobile")}
              </section>
              {editable && <SaveIndicator {...save} short />}
            </div>
          )}

          {editable &&
            (view.rejected ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 380px", minWidth: 0 }}>
                  <label className="form-label" htmlFor="reponse">{e.reply}</label>
                  <textarea className="form-control" id="reponse" rows={3} value={comment} onChange={(ev) => commit(rows, ev.target.value)} />
                </div>
                {history}
              </div>
            ) : (
              <div style={{ maxWidth: 590 }}>
                <label className="form-label" htmlFor="commentaire">{e.comment}</label>
                <textarea className="form-control" id="commentaire" rows={3} value={comment} onChange={(ev) => commit(rows, ev.target.value)} />
              </div>
            ))}
          {!editable && history}

          {editable && rows.length > 0 && (
            <>
              <div className="ts-submitbar ts-wide">
                <div className="ts-submitbar-sum">
                  <p>
                    <span className="h2">{formatHours(total)}</span> {t(e.entered, { expected: formatHours(expectedTotal) })}
                  </p>
                  {!view.rejected && <Progress value={(total * 100) / expectedTotal} label={dict.dashboard.progressLabel} />}
                  <p className="small" id="raison-soumission">{reason}</p>
                </div>
                <button className="btn btn-primary" type="button" disabled={!canSubmit} aria-describedby="raison-soumission" onClick={() => void openSubmit()}>
                  {submitLabel}
                </button>
              </div>
              <div className="ts-narrow ts-section" style={{ gap: 20 }}>
                <div className="ts-submitbar-sum" style={{ paddingTop: 20, borderTop: "2px solid #000000" }}>
                  <p>
                    <span className="h2">{formatHours(total)}</span> {t(e.entered, { expected: formatHours(expectedTotal) })}
                  </p>
                  <Progress value={(total * 100) / expectedTotal} label={dict.dashboard.progressLabel} />
                  <p className="small" id="raison-soumission-mobile">{reason}</p>
                </div>
                {day < days.length - 1 && (
                  <button className="btn btn-lg btn-block" type="button" onClick={nextDay}>
                    {t(e.nextDay, { day: formatWeekdayDay(days[day + 1]!) })}
                  </button>
                )}
                <button
                  className="btn btn-primary btn-lg btn-block"
                  type="button"
                  disabled={!canSubmit}
                  aria-describedby="raison-soumission-mobile"
                  onClick={() => void openSubmit()}
                >
                  {submitLabel}
                </button>
              </div>
            </>
          )}
        </>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={t(e.modalTitle, { week: view.week.week })}
        footer={
          <>
            <button className="btn" type="button" onClick={() => setModal(false)}>
              {dict.form.cancel}
            </button>
            <button className="btn btn-primary" type="button" onClick={confirmSubmit} disabled={submitting}>
              {e.confirm}
            </button>
          </>
        }
      >
        <p>{e.modalIntro}</p>
        {submitError && (
          <Alert tone="danger" role="alert" heading={e.submitErrorTitle}>
            <p>{errorText(submitError, step)}</p>
          </Alert>
        )}
        <dl style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "10px 20px" }}>
          <dt className="text-secondary">{e.period}</dt>
          <dd className="fw-bold">{formatRange(first, last)}</dd>
          <dt className="text-secondary">{e.validator}</dt>
          <dd className="fw-bold">{view.validator ? t(e.validatorName, view.validator) : "—"}</dd>
        </dl>
        <table className="table">
          <caption className="visually-hidden">{t(e.modalCaption, { week: view.week.week })}</caption>
          <thead>
            <tr>
              <th scope="col">{dict.grid.projectActivity}</th>
              <th scope="col" className="num">{e.modalHours}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{`${r.project} · ${r.activity}`}</td>
                <td className="num">{formatHours(sum(numbers[i]!))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{e.weekTotal}</th>
              <td className="num">{t(e.totalOf, { total: formatHours(total), expected: formatHours(expectedTotal) })}</td>
            </tr>
          </tfoot>
        </table>
        <Alert tone="info">
          <p>{e.modalInfo}</p>
        </Alert>
        {submitting && (
          <p className="visually-hidden" role="status">
            {e.submitting}
          </p>
        )}
      </Modal>
    </main>
  );
}

/** Jour ouvert sur mobile : aujourd'hui dans la semaine courante, sinon le premier jour à compléter. */
function initialDay(view: EntryView): number {
  if (view.todayIndex >= 0) return view.todayIndex;
  const totals = view.days.map((_, j) => sum(view.lines.map((l) => l.hours[j] ?? 0)));
  const open = totals.findIndex((tot, j) => tot < (view.expected[j] ?? 0));
  return open >= 0 ? open : 0;
}

/** Brouillon envoyé au serveur ; null si une cellule est refusée. Les lignes verrouillées repartent telles quelles. */
function buildPayload(rows: Row[], comment: string, week: IsoWeek, step: number): DraftPayload | null {
  const lines: DraftPayload["lines"] = [];
  for (const row of rows) {
    if (row.locked) {
      lines.push({ projectId: row.projectId, activityId: row.activityId, hours: row.hours });
      continue;
    }
    const hours: Array<number | null> = [];
    for (const raw of row.values) {
      const p = parseHours(raw, step);
      if (p.kind === "invalid") return null;
      hours.push(p.kind === "ok" ? p.value : null);
    }
    lines.push({ projectId: row.projectId, activityId: row.activityId, hours });
  }
  return { year: week.year, week: week.week, comment, lines };
}

/** « Ajouter une ligne » : Dropdown des projets ouverts à la saisie. Désactivé, la raison est écrite à côté. */
function AddLine({ available, none, label, primary, block, reasonId, onAdd }: {
  available: LineChoice[];
  none: boolean;
  label: string;
  primary?: boolean;
  block?: boolean;
  reasonId: string;
  onAdd: (choice: LineChoice) => void;
}) {
  const className = cx("btn", primary && "btn-primary", block && "btn-lg btn-block");
  if (available.length === 0) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 20px" }}>
        <button className={className} type="button" disabled aria-describedby={reasonId}>
          <Icon name="plus" />
          {label}
        </button>
        <p className="small" id={reasonId}>
          {none ? e.noLineAtAll : e.noMoreLines}
        </p>
      </div>
    );
  }
  return (
    <Dropdown
      label={e.addLineMenu}
      className={block ? "ts-block" : undefined}
      menuStyle={{ minWidth: 320, maxWidth: "calc(100vw - 40px)" }}
      items={available.map((c) => ({
        key: lineKey(c),
        content: (
          <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span>{c.project}</span>
            <span className="small">{c.activity}</span>
          </span>
        ),
        onSelect: () => onAdd(c),
      }))}
      trigger={(p) => (
        <button className={className} type="button" {...p}>
          <Icon name="plus" />
          {label}
        </button>
      )}
    />
  );
}
