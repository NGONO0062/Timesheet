// Fiches de présence à signer (PROMPT.md §19) : onglet de l'écran Validation.
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ods/Display";
import { EmptyState } from "@/components/ts/States";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { monthLabel } from "@/lib/attendance/sheet";
import { countSheetsToCountersign, listSheetsToCountersign, returnedSheetIntern } from "@/lib/data/attendance";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { formatDayMonth, formatTime, zonedDay } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { supervisorAttendanceHref } from "@/lib/routes";
import { ValidationTabs } from "../../ValidationTabs";
import { TableScroll } from "@/components/ods/TableScroll";

export const metadata: Metadata = { title: dict.attendance.supervisorListTitle };

const a = dict.attendance;

type Props = { searchParams: Promise<{ renvoyee?: string }> };

export default async function Page({ searchParams }: Props) {
  const viewer = await requirePermission("VALIDATE_TEAM");
  const scope = scopeOf(viewer);
  const { renvoyee } = await searchParams;
  const [rows, count, returned] = await Promise.all([
    listSheetsToCountersign(scope),
    countSheetsToCountersign(scope),
    renvoyee && /^[a-z0-9]{1,64}$/i.test(renvoyee) ? returnedSheetIntern(scope, renvoyee) : null,
  ]);

  return (
    <main className="container ts-stack">
      <h1>{dict.validation.title}</h1>
      <ValidationTabs current="presence" presenceCount={count ?? 0} />
      {returned && (
        <Alert tone="success" role="status">
          <p>{t(a.rejected, { name: returned })}</p>
        </Alert>
      )}
      <section aria-labelledby="titre-presence" className="ts-section">
        <h2 className="h3" id="titre-presence">{a.supervisorListTitle}</h2>
        {rows.length === 0 ? (
          <EmptyState title={a.supervisorEmptyTitle}>{a.supervisorEmptyText}</EmptyState>
        ) : (
          <TableScroll>
            <table className="table">
              <caption className="visually-hidden">{a.supervisorCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{a.colIntern}</th>
                  <th scope="col">{a.colMonth}</th>
                  <th scope="col">{a.colSigned}</th>
                  <th scope="col">{a.colStatus}</th>
                  <th scope="col">{a.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const month = monthLabel(r.year, r.month);
                  const toSign = r.status === "SIGNED_BY_INTERN";
                  return (
                    <tr key={r.id}>
                      <th scope="row">{r.name}</th>
                      <td>{month}</td>
                      <td>{r.internSignedAt ? `${formatDayMonth(zonedDay(r.internSignedAt))}, ${formatTime(r.internSignedAt)}` : ""}</td>
                      <td><StatusBadge kind="attendance" value={r.status} /></td>
                      <td>
                        <Link href={supervisorAttendanceHref(r.id)} aria-label={t(a.examineLabel, { name: r.name, month })}>
                          {toSign ? a.examine : a.consult}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>
    </main>
  );
}
