// Écran 08 : détail d'une fiche (PROMPT.md §9.3, planche 08). Saisie par jour en lecture seule
// (docs/design-v2.md, §1 et §6) ; commentaire, historique, décision. Le motif n'apparaît et
// n'est requis que pour un rejet ; le manager peut alors signaler des journées.
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { dayOf, ruleCodeOf } from "@/entities/timesheet";
import { plural, useDecision, useReview, type Review } from "@/entities/validation";
import { roleLabel } from "@/entities/viewer";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { formatDateAt, formatDateTime, formatFromTo, formatRange } from "@/shared/lib/format";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Placeholder } from "@/shared/ui/Display";
import { Radio, RadioGroup, TextareaField } from "@/shared/ui/Form";
import { Breadcrumb } from "@/shared/ui/Navigation";
import { EmptyState } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { DayEntry } from "@/widgets/day-entry";

const v = dict.validation;
const REASON_ID = "motif-rejet";
const FLAGS_ID = "journees-signalees";

export function ValidationReviewPage() {
  const { id = "" } = useParams();
  const query = useReview(id);
  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <Breadcrumb items={[{ label: v.title, href: "/validation" }, { label: v.loading }]} />
        <p className="sr-only" role="status">
          {v.loading}
        </p>
        <Placeholder className="h-control w-1/2" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    // Fiche hors de la portée, supprimée ou inconnue : la même réponse (404).
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <main className="flex flex-col gap-30">
        <Breadcrumb items={[{ label: v.title, href: "/validation" }, { label: gone ? v.goneTitle : v.errorTitle }]} />
        {gone ? (
          <EmptyState title={v.goneTitle} actions={<Link className={buttonClass()} to="/validation">{v.backToQueue}</Link>}>
            {v.goneText}
          </EmptyState>
        ) : (
          <Alert tone="danger" role="alert" heading={v.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
            <p>{v.errorText}</p>
          </Alert>
        )}
      </main>
    );
  }
  // Une décision par fiche : changer de fiche repart d'un formulaire vide.
  return <ReviewView key={query.data.id} review={query.data} />;
}

function ReviewView({ review }: { review: Review }) {
  const navigate = useNavigate();
  const location = useLocation();
  const decide = useDecision(review.id);
  const [decision, setDecision] = useState<"VALIDATE" | "REJECT">("VALIDATE");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [flags, setFlags] = useState<boolean[]>(() => review.days.map(() => false));
  const [error, setError] = useState<string | null>(null);
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;

  const pending = review.status === "SUBMITTED";
  const rejecting = pending && decision === "REJECT";
  const days = review.days.map((d) => dayOf(d.date));
  const first = days[0];
  const last = days[days.length - 1];
  const title = t(v.detailTitle, { name: review.name, week: review.week });
  const role = review.isIntern ? dict.dashboard.intern : roleLabel(review.role);
  const range = first && last ? formatRange(first, last) : "";
  const period = first && last ? formatFromTo(first, last) : "";
  const flagCount = flags.filter(Boolean).length;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (rejecting && !reason.trim()) {
      setReasonError(true);
      document.getElementById(REASON_ID)?.focus();
      return;
    }
    const input = rejecting ? { decision: "REJECT" as const, reason, flagged: review.days.filter((_, j) => flags[j]).map((d) => d.date) } : { decision: "VALIDATE" as const };
    decide.mutate(input, {
      onSuccess: (r) => {
        // On enchaîne sur la fiche en attente suivante, avec le résultat annoncé.
        const done = rejecting ? v.doneRejected : v.doneValidated;
        navigate(r.next ? `/validation/${r.next}` : "/validation", { state: { notice: done } });
      },
      onError: (err) => {
        const code = ruleCodeOf(err);
        if (code === "reasonMissing") setReasonError(true);
        else setError(code === "alreadyDecided" ? v.decideError : code === "session" ? dict.entry.errors.session : v.actionError);
      },
    });
  }

  return (
    <main className="flex flex-col gap-30">
      <div className="flex flex-col gap-10">
        <Breadcrumb items={[{ label: v.title, href: "/validation" }, { label: title }]} />
        <div className="flex flex-wrap items-start justify-between gap-20">
          <div className="flex flex-col gap-10">
            <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
              <h1>{title}</h1>
              <StatusBadge kind="timesheet" value={review.status} />
            </div>
            <p className="text-gray-595">
              {review.submittedAt ? t(v.detailSub, { role, range, date: formatDateAt(new Date(review.submittedAt)) }) : t(v.detailSubDraft, { role, range })}
            </p>
          </div>
          {review.position && (
            <nav aria-label={v.browse} className="flex flex-wrap items-center gap-10">
              <span className="text-sm font-bold">{t(v.position, { i: review.position.index, n: review.position.count })}</span>
              {review.position.previous ? (
                <Link className={buttonClass("default", "sm")} to={`/validation/${review.position.previous}`}>
                  {v.previous}
                </Link>
              ) : (
                <Button size="sm" disabled>
                  {v.previous}
                </Button>
              )}
              {review.position.next ? (
                <Link className={buttonClass("default", "sm")} to={`/validation/${review.position.next}`}>
                  {v.next}
                </Link>
              ) : (
                <Button size="sm" disabled>
                  {v.next}
                </Button>
              )}
            </nav>
          )}
        </div>
      </div>

      {notice && (
        <Alert tone="success" role="status">
          <p>{notice}</p>
        </Alert>
      )}

      <section aria-labelledby="titre-jours" className="flex flex-col gap-10">
        <h2 id="titre-jours" className="text-h3">
          {v.hoursTitle}
        </h2>
        {rejecting && <p className="text-sm">{v.flagDayHelp}</p>}
        <DayEntry
          caption={t(v.caption, { week: review.week, period: period.charAt(0).toLowerCase() + period.slice(1) })}
          days={days}
          expected={review.days.map((d) => d.expected)}
          choices={review.choices}
          values={review.days.map((d) => d.value)}
          readOnly
          flagged={pending ? flags : review.days.map((d) => d.flagged)}
          onToggleFlag={rejecting ? (j) => setFlags((fs) => fs.map((f, k) => (k === j ? !f : f))) : undefined}
        />
      </section>

      <div className="grid items-start gap-30 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-30">
          <section aria-labelledby="titre-commentaire" className="flex flex-col gap-10">
            <h2 id="titre-commentaire" className="text-base font-bold">
              {v.commentTitle}
            </h2>
            {review.comment ? <p className="whitespace-pre-line">{review.comment}</p> : <p className="text-gray-595">{v.noComment}</p>}
          </section>
          <section aria-labelledby="titre-histo" className="flex flex-col gap-10">
            <h2 id="titre-histo" className="text-base font-bold">
              {v.historyTitle}
            </h2>
            <ul className="rounded-md border-2 border-gray-999">
              {review.history.map((h) => (
                <li key={`${h.type}-${h.at}`} className="flex flex-wrap justify-between gap-x-20 gap-y-5 border-b-2 border-gray-999 px-20 py-10 last:border-b-0">
                  <span>
                    <span className="font-bold">{v.event[h.type]}</span>
                    {h.type !== "CREATED" && ` ${t(h.type === "REMINDER_SENT" ? v.to : v.by, { name: h.by })}`}
                  </span>
                  <span className="text-sm text-gray-595">{formatDateTime(new Date(h.at))}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {pending ? (
          <form className="flex min-w-0 flex-col gap-20 rounded-md border-2 border-black p-20" onSubmit={submit} noValidate>
            <RadioGroup legend={<span className="block pb-10 text-h3">{v.decision}</span>}>
              {(["VALIDATE", "REJECT"] as const).map((d) => (
                <Radio
                  key={d}
                  name="decision"
                  label={<span className={decision === d ? "font-bold" : undefined}>{d === "VALIDATE" ? v.validate : v.reject}</span>}
                  checked={decision === d}
                  onChange={() => {
                    setDecision(d);
                    setError(null);
                  }}
                />
              ))}
            </RadioGroup>
            {rejecting && (
              <div className="flex flex-col gap-10">
                <TextareaField
                  id={REASON_ID}
                  label={v.reason}
                  required
                  rows={4}
                  maxLength={2000}
                  hint={v.reasonHelp}
                  error={reasonError ? v.reasonMissing : undefined}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (e.target.value.trim()) setReasonError(false);
                  }}
                />
                <p className="text-sm" id={FLAGS_ID} role="status">
                  {flagCount === 0 ? v.flaggedDayNone : plural(flagCount, v.flaggedDayOne, v.flaggedDayMany)}
                </p>
              </div>
            )}
            {error && (
              <Alert tone="danger" role="alert" onClose={() => setError(null)}>
                <p>{error}</p>
              </Alert>
            )}
            <div className="flex flex-wrap justify-end gap-10">
              <Link className={buttonClass()} to="/validation">
                {dict.form.cancel}
              </Link>
              <Button type="submit" variant={rejecting ? "danger" : "primary"} disabled={decide.isPending}>
                {rejecting ? v.reject : v.validate}
              </Button>
            </div>
          </form>
        ) : (
          <Alert tone="info">
            <p>{v.notPending}</p>
          </Alert>
        )}
      </div>
    </main>
  );
}
