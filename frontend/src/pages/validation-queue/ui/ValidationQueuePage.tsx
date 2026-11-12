// Écran 07 : file de validation (PROMPT.md §9.3, planche 07, règles v2 docs/design-v2.md §6).
// Filtres dans l'adresse ; sélection multiple ; barre d'actions groupées seulement avec une
// sélection ; validation groupée directe, rejet groupé dans une modale avec un motif commun.
// Valider par exception : les étiquettes à côté du nom disent ce qui demande un regard.
import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { ruleCodeOf } from "@/entities/timesheet";
import {
  attentionTags,
  DEFAULT_PERIOD,
  parseTab,
  periodOptions,
  plural,
  QUEUE_TABS,
  useGroupDecision,
  useQueue,
  type DecisionResult,
  type Queue,
  type QueueRow,
  type QueueTab,
} from "@/entities/validation";
import { dict, t } from "@/shared/i18n";
import { formatDayMonth, formatRange, formatTime, zonedDay } from "@/shared/lib/format";
import { addDays } from "@/shared/lib/iso-week";
import { dayOf } from "@/entities/timesheet";
import { Button } from "@/shared/ui/Button";
import { Alert, Badge, Placeholder, Table, Tag } from "@/shared/ui/Display";
import { Pills } from "@/shared/ui/Disclosure";
import { Checkbox, SelectField, TextareaField } from "@/shared/ui/Form";
import { Modal } from "@/shared/ui/Overlay";
import { EmptyState } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";

const v = dict.validation;
const REASON_ID = "motif-commun";

const COUNT_OF: Record<QueueTab, keyof Queue["counts"]> = { SUBMITTED: "submitted", VALIDATED: "validated", REJECTED: "rejected", ALL: "all" };

const weekText = (r: QueueRow) => {
  const monday = dayOf(r.monday);
  return t(v.weekShort, { week: r.week, range: formatRange(monday, addDays(monday, 4), false) });
};
const submittedText = (at: string | null) => {
  if (!at) return "";
  const instant = new Date(at);
  return `${formatDayMonth(zonedDay(instant))}, ${formatTime(instant)}`;
};

export function ValidationQueuePage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const filters = { personId: params.get("personne"), period: params.get("periode") ?? DEFAULT_PERIOD, tab: parseTab(params.get("statut")) };
  const query = useQueue(filters);
  const decide = useGroupDecision();

  // Sélection propre aux filtres affichés : changer de filtre la vide.
  const filterKey = params.toString();
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: filterKey, ids: new Set() });
  const selected = selection.key === filterKey ? selection.ids : new Set<string>();
  const setSelected = (ids: Set<string>) => setSelection({ key: filterKey, ids });

  // Message après une décision prise depuis le détail (dernière fiche en attente).
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(k);
      else next.set(k, value);
    }
    setNotice(null);
    setError(null);
    setParams(next, { replace: false });
  }

  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <h1>{v.title}</h1>
        <p className="sr-only" role="status">
          {v.loading}
        </p>
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="flex flex-col gap-30">
        <h1>{v.title}</h1>
        <Alert tone="danger" role="alert" heading={v.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
          <p>{v.errorText}</p>
        </Alert>
      </main>
    );
  }

  const data = query.data;
  const periods = periodOptions(data.current);
  // Fiches sur lesquelles le validateur peut agir ; une fiche qui attend l'autre étape du circuit se consulte.
  const pendingRows = data.rows.filter((r) => r.actionable);
  const chosen = pendingRows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allChosen = pendingRows.length > 0 && chosen.length === pendingRows.length;
  // « En attente » : la colonne Statut répéterait la même valeur partout (design v2, §6).
  const showStatus = filters.tab !== "SUBMITTED";

  function toggle(id: string) {
    setNotice(null);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function report(r: DecisionResult, kind: "validated" | "rejected") {
    const final = r.done - r.forwarded;
    const main =
      kind === "rejected"
        ? plural(r.done, v.rejectedOne, v.rejectedMany)
        : [final > 0 ? plural(final, v.validatedOne, v.validatedMany) : "", r.forwarded > 0 ? plural(r.forwarded, v.forwardedOne, v.forwardedMany) : ""].filter(Boolean).join(" ");
    const skipped = r.skipped > 0 ? plural(r.skipped, v.skippedOne, v.skippedMany) : "";
    setNotice(r.done > 0 ? [main, skipped].filter(Boolean).join(" ") : skipped);
    setSelected(new Set());
  }

  function validateSelection() {
    setError(null);
    decide.mutate({ ids: chosen, decision: "VALIDATE" }, { onSuccess: (r) => report(r, "validated"), onError: () => setError(v.actionError) });
  }

  function confirmReject() {
    if (!reason.trim()) {
      setReasonError(true);
      document.getElementById(REASON_ID)?.focus();
      return;
    }
    setError(null);
    decide.mutate(
      { ids: chosen, decision: "REJECT", reason },
      {
        onSuccess: (r) => {
          report(r, "rejected");
          setRejecting(false);
          setReason("");
        },
        onError: (e) => {
          if (ruleCodeOf(e) === "reasonMissing") setReasonError(true);
          else {
            setRejecting(false);
            setError(v.actionError);
          }
        },
      },
    );
  }

  const pendingCount = data.counts.submitted;

  return (
    <main className="flex flex-col gap-30">
      <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
        <h1>{v.title}</h1>
        <Badge tone={pendingCount > 0 ? "info" : undefined}>{t(v.pendingCount, { n: pendingCount })}</Badge>
      </div>

      <form aria-label={v.filters} className="flex flex-wrap items-end gap-x-20 gap-y-10" onSubmit={(e) => e.preventDefault()}>
        <div className="w-full md:w-filter">
          <SelectField label={v.person} value={filters.personId ?? ""} onChange={(e) => go({ personne: e.target.value })}>
            <option value="">{t(v.wholeTeam, { n: data.people.length })}</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-full md:w-filter">
          <SelectField label={v.period} value={filters.period} onChange={(e) => go({ periode: e.target.value === DEFAULT_PERIOD ? null : e.target.value })}>
            {periods.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </SelectField>
        </div>
        <Button variant="link" className="min-h-control" onClick={() => go({ personne: null, periode: null })}>
          {v.reset}
        </Button>
      </form>

      <Pills
        label={v.statusFilter}
        value={filters.tab}
        onChange={(tab) => go({ statut: tab === "SUBMITTED" ? null : tab })}
        options={QUEUE_TABS.map((tab) => ({ value: tab, label: t(v.tabs[tab], { n: data.counts[COUNT_OF[tab]] }) }))}
      />

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

      {data.rows.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title={v.emptyTitle[filters.tab]}
          actions={
            filters.tab === "SUBMITTED" ? (
              <Button onClick={() => go({ statut: "VALIDATED" })}>{v.seeValidated}</Button>
            ) : filters.period !== "tout" ? (
              <Button onClick={() => go({ periode: "tout" })}>{v.seeAllPeriods}</Button>
            ) : undefined
          }
        >
          {v.emptyText[filters.tab]}
        </EmptyState>
      ) : (
        <section aria-label={v.sections[filters.tab]} className="flex flex-col gap-10 md:gap-0">
          {chosen.length > 0 && (
            <div role="region" aria-label={v.groupActions} className="flex flex-wrap items-center justify-between gap-x-20 gap-y-10 rounded-md border-2 border-black bg-gray-fa px-20 py-10 md:rounded-b-none">
              <p className="font-bold" role="status">
                {plural(chosen.length, v.selectedOne, v.selectedMany)}
              </p>
              <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
                <Button variant="link" onClick={() => setSelected(new Set())}>
                  {v.clearSelection}
                </Button>
                <Button
                  disabled={decide.isPending}
                  onClick={() => {
                    setReasonError(false);
                    setRejecting(true);
                  }}
                >
                  {v.rejectSelection}
                </Button>
                <Button variant="primary" disabled={decide.isPending} onClick={validateSelection}>
                  {v.validateSelection}
                </Button>
              </div>
            </div>
          )}
          <div className="hidden md:block">
            <Table caption={v.captions[filters.tab]}>
              <thead>
                <tr>
                  <th scope="col" className="w-check-col">
                    {pendingRows.length > 0 && (
                      <Checkbox
                        label={<span className="sr-only">{v.selectAll}</span>}
                        checked={allChosen}
                        onChange={() => setSelected(allChosen ? new Set() : new Set(pendingRows.map((r) => r.id)))}
                      />
                    )}
                  </th>
                  <th scope="col">{v.colPerson}</th>
                  <th scope="col">{v.colWeek}</th>
                  <th scope="col" className="text-right">
                    {v.colHours}
                  </th>
                  <th scope="col" className="text-right">
                    {v.colProjects}
                  </th>
                  <th scope="col">{v.colSubmitted}</th>
                  {showStatus && <th scope="col">{v.colStatus}</th>}
                  <th scope="col">{v.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const tags = attentionTags(r);
                  return (
                    <tr key={r.id}>
                      <td>
                        {r.actionable && (
                          <Checkbox
                            label={<span className="sr-only">{t(v.selectOne, { name: r.name, week: weekText(r) })}</span>}
                            checked={selected.has(r.id)}
                            onChange={() => toggle(r.id)}
                          />
                        )}
                      </td>
                      <th scope="row">
                        <span className="flex flex-wrap items-center gap-x-10 gap-y-5">
                          <span className="whitespace-nowrap">{r.name}</span>
                          {r.approvedBy && <span className="text-sm font-normal">{t(v.approvedBy, { name: r.approvedBy })}</span>}
                          {tags.length > 0 && (
                            <span className="flex flex-wrap gap-5 font-normal">
                              <span className="sr-only">{v.attentionLabel} :</span>
                              {tags.map((tag) => (
                                <Tag key={tag}>{tag}</Tag>
                              ))}
                            </span>
                          )}
                        </span>
                      </th>
                      <td className="whitespace-nowrap">{weekText(r)}</td>
                      <td className="text-right whitespace-nowrap tabular-nums">
                        {r.filled} / {r.expected}
                      </td>
                      <td className="text-right tabular-nums">{r.projects}</td>
                      <td className="whitespace-nowrap">{submittedText(r.submittedAt)}</td>
                      {showStatus && (
                        <td>
                          <StatusBadge kind="timesheet" value={r.status} />
                        </td>
                      )}
                      <td>
                        <Link to={`/validation/${r.id}`}>{r.actionable ? v.review : v.consult}</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          {/* Mobile : une fiche par ligne, sans défilement horizontal. */}
          <div className="flex flex-col gap-10 md:hidden">
            {pendingRows.length > 0 && (
              <Checkbox
                label={v.selectAll}
                checked={allChosen}
                onChange={() => setSelected(allChosen ? new Set() : new Set(pendingRows.map((r) => r.id)))}
              />
            )}
            <ul className="flex flex-col rounded-md border-2 border-gray-999" aria-label={v.captions[filters.tab]}>
              {data.rows.map((r) => (
                <li key={r.id} className="flex items-start gap-10 border-b-2 border-gray-999 p-10 last:border-b-0">
                  {r.actionable && (
                    <Checkbox
                      label={<span className="sr-only">{t(v.selectOne, { name: r.name, week: weekText(r) })}</span>}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-5">
                    <Link to={`/validation/${r.id}`} className="font-bold">
                      {r.name}
                    </Link>
                    <span className="text-sm text-gray-595">{`${weekText(r)} · ${r.filled} / ${r.expected} · ${submittedText(r.submittedAt)}`}</span>
                    {r.approvedBy && <span className="text-sm">{t(v.approvedBy, { name: r.approvedBy })}</span>}
                    {(attentionTags(r).length > 0 || showStatus) && (
                      <span className="flex flex-wrap gap-5">
                        {showStatus && <StatusBadge kind="timesheet" value={r.status} />}
                        {attentionTags(r).map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="pt-10 text-sm text-gray-595">{plural(data.rows.length, v.footOne[filters.tab], v.footMany[filters.tab])}</p>
        </section>
      )}

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={plural(chosen.length, v.rejectTitleOne, v.rejectTitleMany)}
        footer={
          <>
            <Button onClick={() => setRejecting(false)}>{dict.form.cancel}</Button>
            <Button variant="danger" disabled={decide.isPending} onClick={confirmReject}>
              {v.rejectShort}
            </Button>
          </>
        }
      >
        <TextareaField
          id={REASON_ID}
          label={v.groupReason}
          required
          rows={4}
          maxLength={2000}
          hint={v.groupReasonHelp}
          error={reasonError ? v.reasonMissing : undefined}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (e.target.value.trim()) setReasonError(false);
          }}
        />
      </Modal>
    </main>
  );
}
