// Écrans 03 (saisie), 04 (confirmation) et 05 (fiche rejetée), saisie par jour (docs/design-v2.md).
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { daySummary, dayOf, ruleCodeOf, useCurrentWeek, useSubmitWeek, useWeek, type Week } from "@/entities/timesheet";
import { SubmitDialog, useWeekDraft } from "@/features/week-entry";
import { dict, t } from "@/shared/i18n";
import { compareWeeks, isValidIsoWeek, type IsoWeek } from "@/shared/lib/iso-week";
import { capitalize, formatDateTime, formatLongDateAt, formatRange } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { Alert, Placeholder, Progress } from "@/shared/ui/Display";
import { TextareaField } from "@/shared/ui/Form";
import { Breadcrumb } from "@/shared/ui/Navigation";
import { EmptyState, SaveIndicator } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { DayEntry } from "@/widgets/day-entry";
import { WeekSelector } from "@/widgets/week-selector";
import { EntryShortcuts } from "./EntryShortcuts";

const e = dict.entry;
const FLAGGED_ANCHOR = "journee-signalee";

/** /saisie : la semaine courante, sur l'horloge du serveur. */
export function CurrentWeekRedirect() {
  const current = useCurrentWeek();
  if (!current.data) return <Placeholder className="w-1/2" />;
  return <Navigate to={`/saisie/${current.data.year}/${current.data.week}`} replace />;
}

export function WeekEntryPage() {
  const params = useParams();
  const week: IsoWeek = { year: Number(params.year), week: Number(params.week) };
  const valid = Number.isInteger(week.year) && Number.isInteger(week.week) && isValidIsoWeek(week);
  const query = useWeek(week);
  if (!valid) return <Navigate to="/saisie" replace />;
  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <h1>{e.title}</h1>
        <p className="sr-only" role="status">
          {e.loading}
        </p>
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="flex flex-col gap-30">
        <h1>{e.title}</h1>
        <Alert tone="danger" role="alert" heading={e.errorTitle}>
          <p>{e.errorText}</p>
        </Alert>
      </main>
    );
  }
  // Une saisie par semaine : changer de semaine repart de ce que le serveur a enregistré.
  return <WeekView key={`${week.year}-${week.week}`} week={query.data} />;
}

function errorText(code: string): string {
  if (code === "noValidator") return e.noValidator;
  return (e.errors as Record<string, string>)[code] ?? e.errors.unknown;
}

function WeekView({ week }: { week: Week }) {
  const navigate = useNavigate();
  const draft = useWeekDraft(week);
  const submit = useSubmitWeek(week);
  const [dialog, setDialog] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const days = week.days.map((d) => dayOf(d.date));
  const expected = week.days.map((d) => d.expected);
  const first = days[0];
  const last = days[days.length - 1];
  const period = first && last ? formatRange(first, last) : "";
  const summary = daySummary(days, expected, draft.values);
  const rejected = week.status === "REJECTED";
  const flagged = week.days.map((d) => d.flagged);
  const future = !week.allowFutureWeeks && compareWeeks(week, week.current) > 0;
  const go = (w: IsoWeek) => navigate(`/saisie/${w.year}/${w.week}`);

  const selector = (large: boolean) => (
    <WeekSelector
      week={week}
      current={week.current}
      onNavigate={go}
      allowFutureWeeks={week.allowFutureWeeks}
      recent={week.recent.map((r) => ({ week: { year: r.year, week: r.week }, status: r.status }))}
      large={large}
    />
  );

  function confirm() {
    setSubmitError(null);
    submit.mutate(draft.current(), {
      onSuccess: () => {
        setDialog(false);
        setJustSubmitted(true);
      },
      onError: (err) => {
        setDialog(false);
        setSubmitError(ruleCodeOf(err));
      },
    });
  }

  return (
    <main className="flex flex-col gap-30">
      <div className="flex flex-col gap-10">
        <div className="hidden md:block">
          <Breadcrumb items={[{ label: dict.dashboard.title, href: "/tableau-de-bord" }, { label: e.title }]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
          <h1>
            <span className="hidden md:inline">{e.title}</span>
            <span className="md:hidden">{e.titleShort}</span>
          </h1>
          <StatusBadge kind="timesheet" value={week.status} />
        </div>
      </div>

      {rejected && week.decision && (
        <Alert tone="danger" role="alert" heading={t(e.rejectedHeading, { name: week.decision.by })}>
          <p className="text-sm text-gray-595">{capitalize(formatLongDateAt(new Date(week.decision.at)))}</p>
          {week.decision.reason && <p>{t(e.rejectedReason, { reason: week.decision.reason })}</p>}
          {flagged.some(Boolean) && week.editable && <a href={`#${FLAGGED_ANCHOR}`}>{dict.dayEntry.goToFlagged}</a>}
        </Alert>
      )}

      {justSubmitted && (
        <Alert tone="success" role="status" heading={t(e.justSubmittedTitle, { week: week.week })} action={<Link to="/tableau-de-bord">{e.backToDashboard}</Link>}>
          <p>{t(e.justSubmittedText, { name: week.validator ?? "" })}</p>
        </Alert>
      )}
      {submitError && (
        <Alert tone="danger" role="alert" heading={e.submitErrorTitle} onClose={() => setSubmitError(null)}>
          <p>{errorText(submitError)}</p>
        </Alert>
      )}

      <div className="flex flex-col gap-10">
        <div className="flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
          <div className="hidden md:block">{selector(false)}</div>
          <div className="w-full md:hidden">{selector(true)}</div>
          {week.editable && !future && <SaveIndicator state={draft.save.state} time={draft.save.time} message={draft.save.message && errorText(draft.save.message)} />}
        </div>
        {rejected && week.editable && draft.save.state !== "saved" && <SaveIndicator state="info" message={e.reopened} />}
      </div>

      {future ? (
        <EmptyState
          headingLevel={2}
          title={e.futureTitle}
          actions={
            <Button onClick={() => go(week.current)}>{e.goToCurrent}</Button>
          }
        >
          {e.futureText}
        </EmptyState>
      ) : (
        <>
          {week.status === "SUBMITTED" && week.submittedAt && !justSubmitted && (
            <Alert tone="info">
              <p>
                {week.approval
                  ? t(e.approvedInfo, { name: week.approval.by, date: formatDateTime(new Date(week.approval.at)) })
                  : t(e.submittedInfo, { date: formatDateTime(new Date(week.submittedAt)), name: week.validator ?? "" })}
              </p>
            </Alert>
          )}
          {week.status === "VALIDATED" && week.decision && (
            <Alert tone="success">
              <p>{t(week.editable ? e.validatedEditable : e.validatedInfo, { name: week.decision.by, date: formatDateTime(new Date(week.decision.at)) })}</p>
            </Alert>
          )}

          {week.editable && <p className="text-sm text-gray-595">{e.rule}</p>}
          {week.editable && week.choices.length > 0 && <EntryShortcuts week={week} values={draft.values} onApply={draft.setAll} />}

          {week.editable && week.choices.length === 0 ? (
            <EmptyState headingLevel={2} title={dict.dayEntry.noChoiceTitle}>
              {dict.dayEntry.noChoiceText}
            </EmptyState>
          ) : (
            <DayEntry
              caption={t(week.editable ? e.caption : e.captionReadonly, { week: week.week, period })}
              days={days}
              expected={expected}
              choices={week.choices}
              values={week.editable ? draft.values : week.days.map((d) => d.value)}
              onChange={draft.setDay}
              readOnly={!week.editable}
              futureDays={week.days.map((d) => d.isFuture)}
              flagged={flagged}
              flaggedAnchor={FLAGGED_ANCHOR}
            />
          )}

          {(week.editable || week.history.length > 0) && (
            <div className="grid gap-30 md:grid-cols-2">
              {week.editable && (
                <TextareaField label={rejected ? e.reply : e.comment} value={draft.comment} maxLength={2000} onChange={(ev) => draft.setComment(ev.target.value)} />
              )}
              {week.history.length > 0 && (
                <section className="flex flex-col gap-5">
                  <h2 className="font-bold text-base">{e.historyTitle}</h2>
                  <ul className="rounded-md border-2 border-gray-999">
                    {week.history.map((h) => (
                      <li key={`${h.type}-${h.at}`} className="flex flex-wrap justify-between gap-x-20 gap-y-5 border-b-2 border-gray-999 px-20 py-10 last:border-b-0">
                        <span>
                          <span className="font-bold">{e.event[h.type]}</span> {h.byYou ? e.byYou : t(e.by, { name: h.by })}
                        </span>
                        <span className="text-sm text-gray-595">{formatDateTime(new Date(h.at))}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {week.editable && week.choices.length > 0 && (
            <div className="flex flex-wrap items-end justify-between gap-x-30 gap-y-20 border-t-2 border-black pt-20">
              <div className="flex min-w-0 flex-1 flex-col gap-10">
                <p className="text-h4 font-bold">{summary.label}</p>
                <Progress value={(summary.filled / Math.max(1, summary.expected)) * 100} label={e.title} tone={summary.check.canSubmit ? "success" : undefined} />
                <p className="text-sm">{rejected && summary.check.canSubmit ? t(dict.dayEntry.resubmitHint, { name: week.validator ?? "" }) : summary.check.message}</p>
              </div>
              <Button variant="primary" className="w-full md:w-auto" disabled={!summary.check.canSubmit} onClick={() => setDialog(true)}>
                {rejected ? dict.grid.resubmit : dict.grid.submit}
              </Button>
            </div>
          )}
        </>
      )}

      <SubmitDialog open={dialog} week={week} values={draft.values} pending={submit.isPending} onClose={() => setDialog(false)} onConfirm={confirm} />
    </main>
  );
}
