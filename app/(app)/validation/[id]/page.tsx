// Écran 8 : détail d'une fiche (PROMPT.md §9.3, planche 08-Detail-fiche).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ods/Display";
import { Breadcrumb } from "@/components/ods/Navigation";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { getReview, listPendingIds } from "@/lib/data/validation";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { formatDateAt, formatDateTime, formatFromTo, formatRange } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { roleLabel } from "@/lib/viewer";
import { ReviewPanel } from "./ReviewPanel";

export const metadata: Metadata = { title: dict.validation.title };

const v = dict.validation;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fait?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const viewer = await requirePermission("VALIDATE_TEAM");
  const scope = scopeOf(viewer);
  const { id } = await params;
  const review = await getReview(scope, id);
  if (!review) notFound();
  const pending = await listPendingIds(scope);
  const position = pending.indexOf(review.id);
  const { fait } = await searchParams;

  const title = t(v.detailTitle, { name: review.name, week: review.week.week });
  const first = review.days[0]!;
  const last = review.days.at(-1)!;
  const role = review.isIntern ? dict.dashboard.intern : roleLabel(review.role);
  const period = formatFromTo(first, last);
  const notice = fait === "validee" ? v.doneValidated : fait === "rejetee" ? v.doneRejected : null;

  return (
    <main className="container ts-stack">
      <div className="ts-section">
        <Breadcrumb items={[{ label: v.title, href: "/validation" }, { label: title }]} />
        <div className="ts-head" style={{ alignItems: "flex-start", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="ts-head-start">
              <h1>{title}</h1>
              <StatusBadge kind="timesheet" value={review.status} />
            </div>
            <p className="text-secondary">
              {review.submittedAt
                ? t(v.detailSub, { role, range: formatRange(first, last), date: formatDateAt(review.submittedAt) })
                : t(v.detailSubDraft, { role, range: formatRange(first, last) })}
            </p>
          </div>
          {position >= 0 && (
            <nav aria-label={v.browse} className="ts-head-start" style={{ gap: 10 }}>
              <span className="small fw-bold">{t(v.position, { i: position + 1, n: pending.length })}</span>
              {position > 0 ? (
                <Link className="btn btn-sm" href={`/validation/${pending[position - 1]}`}>{v.previous}</Link>
              ) : (
                <button className="btn btn-sm" type="button" disabled>{v.previous}</button>
              )}
              {position < pending.length - 1 ? (
                <Link className="btn btn-sm" href={`/validation/${pending[position + 1]}`}>{v.next}</Link>
              ) : (
                <button className="btn btn-sm" type="button" disabled>{v.next}</button>
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

      <ReviewPanel
        key={review.id}
        sheet={{
          id: review.id,
          pending: review.status === "SUBMITTED",
          caption: t(v.caption, { week: review.week.week, period: period.charAt(0).toLowerCase() + period.slice(1) }),
          days: review.days.map((d) => d.toISOString()),
          expected: review.expected,
          lines: review.lines,
          comment: review.comment,
          events: review.events.map((e) => ({
            id: e.id,
            label: v.event[e.type as keyof typeof v.event] ?? e.type,
            by: e.type === "CREATED" ? "" : t(e.type === "REMINDER_SENT" ? v.to : v.by, { name: e.actor }),
            at: formatDateTime(e.at),
          })),
        }}
      />
    </main>
  );
}
