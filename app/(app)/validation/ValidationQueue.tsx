"use client";
// File de validation (07-File-validation et prototype 07) : filtres dans l'adresse,
// sélection multiple, barre d'actions groupées seulement avec une sélection,
// validation groupée directe, rejet groupé dans une modale avec un motif commun.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { rejectSheets, validateSheets, type GroupResult } from "@/app/actions/validation";
import { Alert, Tag } from "@/components/ods/Display";
import { FieldError } from "@/components/ods/Form";
import { Mark } from "@/components/ods/Icon";
import { Modal } from "@/components/ods/Overlay";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { cx } from "@/lib/cx";
import { dict, t } from "@/lib/i18n";
import type { StoredStatus } from "@/lib/timesheet/rules";
import { plural, QUEUE_TABS, type QueueTab } from "@/lib/validation/queue";

const v = dict.validation;

export type QueueView = {
  people: Array<{ id: string; name: string }>;
  personId: string;
  periods: Array<{ key: string; label: string }>;
  periodKey: string;
  defaultPeriodKey: string;
  tab: QueueTab;
  counts: Record<QueueTab, number>;
  notice: string | null;
  rows: Array<{
    id: string;
    name: string;
    week: string;
    hours: string;
    projects: number;
    submitted: string;
    status: StoredStatus;
    tag: string | null;
  }>;
};

export function ValidationQueue({ view }: { view: QueueView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(view.notice);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [motif, setMotif] = useState("");
  const [motifError, setMotifError] = useState(false);
  const [pending, start] = useTransition();
  const motifId = useId();

  const pendingRows = view.rows.filter((r) => r.status === "SUBMITTED");
  const chosen = pendingRows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allChosen = pendingRows.length > 0 && chosen.length === pendingRows.length;

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    next.delete("fait");
    for (const [k, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(k);
      else next.set(k, value);
    }
    setSelected(new Set());
    setNotice(null);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggle(id: string) {
    setNotice(null);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function report(r: GroupResult, kind: "validated" | "rejected") {
    if (!r.ok) {
      if (r.error === "reasonMissing") setMotifError(true);
      else setError(v.actionError);
      return false;
    }
    const main = kind === "validated" ? plural(r.done, v.validatedOne, v.validatedMany) : plural(r.done, v.rejectedOne, v.rejectedMany);
    const skipped = r.skipped > 0 ? ` ${plural(r.skipped, v.skippedOne, v.skippedMany)}` : "";
    setNotice(r.done > 0 ? main + skipped : skipped.trim());
    setSelected(new Set());
    return true;
  }

  function validateSelection() {
    setError(null);
    start(async () => {
      report(await validateSheets(chosen), "validated");
    });
  }

  function confirmReject() {
    if (!motif.trim()) {
      setMotifError(true);
      document.getElementById(motifId)?.focus();
      return;
    }
    setError(null);
    start(async () => {
      if (report(await rejectSheets(chosen, motif), "rejected")) {
        setRejecting(false);
        setMotif("");
      }
    });
  }


  return (
    <main className="container ts-stack">
      <div className="ts-head-start">
        <h1>{v.title}</h1>
        <span className={cx("badge", view.counts.SUBMITTED > 0 && "bg-info")}>{t(v.pendingCount, { n: view.counts.SUBMITTED })}</span>
      </div>

      <form aria-label={v.filters} className="ts-filters" onSubmit={(e) => e.preventDefault()}>
        <div className="ts-filter">
          <label className="form-label" htmlFor="f-personne">{v.person}</label>
          <select className="form-select" id="f-personne" value={view.personId} onChange={(e) => go({ personne: e.target.value })}>
            <option value="">{t(v.wholeTeam, { n: view.people.length })}</option>
            {view.people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="ts-filter">
          <label className="form-label" htmlFor="f-periode">{v.period}</label>
          <select className="form-select" id="f-periode" value={view.periodKey} onChange={(e) => go({ periode: e.target.value === view.defaultPeriodKey ? null : e.target.value })}>
            {view.periods.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-link" type="button" style={{ minHeight: 40 }} onClick={() => go({ personne: null, periode: null })}>
          {v.reset}
        </button>
      </form>

      <ul className="nav nav-pills" aria-label={v.statusFilter}>
        {QUEUE_TABS.map((tab) => (
          <li key={tab}>
            <button
              className={cx("nav-link", tab === view.tab && "active")}
              type="button"
              aria-pressed={tab === view.tab}
              onClick={() => go({ statut: tab === "SUBMITTED" ? null : tab })}
            >
              {t(v.tabs[tab], { n: view.counts[tab] })}
            </button>
          </li>
        ))}
      </ul>

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

      {view.rows.length === 0 ? (
        <div className="ts-empty" role="status">
          <Mark tone={view.tab === "SUBMITTED" ? "success" : "info"} />
          <h2 className="h3">{v.emptyTitle[view.tab]}</h2>
          <p>{v.emptyText[view.tab]}</p>
          {view.tab === "SUBMITTED" ? (
            <button className="btn" type="button" onClick={() => go({ statut: "VALIDATED" })}>
              {v.seeValidated}
            </button>
          ) : (
            view.periodKey !== "tout" && (
              <button className="btn" type="button" onClick={() => go({ periode: "tout" })}>
                {v.seeAllPeriods}
              </button>
            )
          )}
        </div>
      ) : (
        <section aria-label={v.sections[view.tab]} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {chosen.length > 0 && (
            <div className="card card-strong card-muted ts-bulkbar" role="region" aria-label={v.groupActions}>
              <p className="fw-bold" role="status">
                {plural(chosen.length, v.selectedOne, v.selectedMany)}
              </p>
              <div className="ts-head-start">
                <button className="btn btn-link" type="button" onClick={() => setSelected(new Set())}>
                  {v.clearSelection}
                </button>
                <button className="btn" type="button" disabled={pending} onClick={() => { setMotifError(false); setRejecting(true); }}>
                  {v.rejectSelection}
                </button>
                <button className="btn btn-primary" type="button" disabled={pending} onClick={validateSelection}>
                  {v.validateSelection}
                </button>
              </div>
            </div>
          )}
          <div className="table-responsive">
            <table className="table">
              <caption className="visually-hidden">{v.captions[view.tab]}</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 40 }}>
                    {pendingRows.length > 0 && (
                      <input
                        className="form-check-input"
                        type="checkbox"
                        aria-label={v.selectAll}
                        checked={allChosen}
                        onChange={() => setSelected(allChosen ? new Set() : new Set(pendingRows.map((r) => r.id)))}
                      />
                    )}
                  </th>
                  <th scope="col">{v.colPerson}</th>
                  <th scope="col">{v.colWeek}</th>
                  <th scope="col" className="num">{v.colHours}</th>
                  <th scope="col" className="num">{v.colProjects}</th>
                  <th scope="col">{v.colSubmitted}</th>
                  <th scope="col">{v.colStatus}</th>
                  <th scope="col">{v.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.status === "SUBMITTED" && (
                        <input
                          className="form-check-input"
                          type="checkbox"
                          aria-label={t(v.selectOne, { name: r.name, week: r.week })}
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                        />
                      )}
                    </td>
                    <th scope="row" style={{ whiteSpace: "nowrap" }}>{r.name}</th>
                    <td style={{ whiteSpace: "nowrap" }}>{r.week}</td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>{r.hours}</td>
                    <td className="num">{r.projects}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.submitted}</td>
                    <td>
                      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 5 }}>
                        <StatusBadge kind="timesheet" value={r.status} />
                        {r.tag && <Tag>{r.tag}</Tag>}
                      </span>
                    </td>
                    <td>
                      <Link href={`/validation/${r.id}`}>{r.status === "SUBMITTED" ? v.review : v.consult}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small text-secondary" style={{ paddingTop: 10 }}>
            {plural(view.rows.length, v.footOne[view.tab], v.footMany[view.tab])}
          </p>
        </section>
      )}

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={plural(chosen.length, v.rejectTitleOne, v.rejectTitleMany)}
        footer={
          <>
            <button className="btn" type="button" onClick={() => setRejecting(false)}>
              {dict.form.cancel}
            </button>
            <button className="btn btn-danger" type="button" disabled={pending} onClick={confirmReject}>
              {v.rejectShort}
            </button>
          </>
        }
      >
        <div>
          <label className="form-label is-required" htmlFor={motifId}>{v.groupReason}</label>
          <textarea
            className={cx("form-control", motifError && "is-invalid")}
            id={motifId}
            rows={4}
            aria-required="true"
            aria-invalid={motifError || undefined}
            aria-describedby={cx(`${motifId}-aide`, motifError && `${motifId}-erreur`)}
            value={motif}
            onChange={(e) => {
              setMotif(e.target.value);
              if (e.target.value.trim()) setMotifError(false);
            }}
          />
          <p className="form-text" id={`${motifId}-aide`}>{v.groupReasonHelp}</p>
          {motifError && <FieldError id={`${motifId}-erreur`}>{v.reasonMissing}</FieldError>}
        </div>
      </Modal>
    </main>
  );
}
