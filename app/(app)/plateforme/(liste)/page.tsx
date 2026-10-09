// Écran 13 : administration plateforme (PROMPT.md §9.10, planche 13-Admin-plateforme).
// Divisions, puis journal d'audit.
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ods/Button";
import { Alert, Tag } from "@/components/ods/Display";
import { EmptyState } from "@/components/ts/States";
import { StatusBadge } from "@/components/ts/StatusBadge";
import type { AuditParams } from "@/lib/audit/filters";
import { getDivisionDetail, getOnboarding, listDivisions } from "@/lib/data/platform";
import { requirePlatformAdmin } from "@/lib/data/viewer";
import { formatShortDate, zonedDay } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { AuditLog } from "../AuditLog";
import { loadAudit } from "../load";
import { TableScroll } from "@/components/ods/TableScroll";

export const metadata: Metadata = { title: dict.platform.title };

const p = dict.platform;

type Props = { searchParams: Promise<AuditParams & { enregistree?: string; creee?: string }> };

/** Message de retour d'un onboarding : enregistré pour plus tard, ou division créée. */
async function noticeOf(scope: { userId: string; role: "PLATFORM_ADMIN" }, sp: { enregistree?: string; creee?: string }) {
  const id = sp.creee ?? sp.enregistree;
  if (!id || !/^[a-z0-9]{1,64}$/i.test(id)) return null;
  if (sp.creee) {
    const d = await getDivisionDetail(scope, id);
    const email = d?.admins[0]?.split(" · ")[1];
    return d && d.status === "ACTIVE" && email ? t(p.created, { name: d.name, email }) : null;
  }
  const o = await getOnboarding(scope, id).catch(() => null);
  return o ? t(p.saved, { name: o.identity.name, n: o.step }) : null;
}

export default async function Page({ searchParams }: Props) {
  const viewer = await requirePlatformAdmin();
  const scope = { userId: viewer.userId, role: "PLATFORM_ADMIN" as const };
  const sp = await searchParams;
  const [divisions, audit, notice] = await Promise.all([listDivisions(scope), loadAudit(scope, sp), noticeOf(scope, sp)]);

  return (
    <main className="container ts-stack">
      <div className="ts-head">
        <h1>{p.title}</h1>
        <ButtonLink variant="primary" icon="plus" href="/plateforme/divisions/nouvelle">
          {p.add}
        </ButtonLink>
      </div>
      {notice && (
        <Alert tone="success" role="status">
          <p>{notice}</p>
        </Alert>
      )}
      <Alert tone="info">
        <p>{p.isolation}</p>
      </Alert>

      {divisions.length === 0 ? (
        <EmptyState title={p.empty}>{p.emptyHint}</EmptyState>
      ) : (
        <TableScroll>
          <table className="table">
            <caption className="visually-hidden">{p.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{p.colDivision}</th>
                <th scope="col">{p.colTenant}</th>
                <th scope="col">{p.colAdmin}</th>
                <th scope="col" className="num">{p.colUsers}</th>
                <th scope="col">{p.colState}</th>
                <th scope="col">{p.colCreated}</th>
                <th scope="col">{p.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {divisions.map((d) => (
                <tr key={d.id}>
                  <th scope="row">
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
                      {d.name}
                      {d.pilot && <Tag>{p.pilot}</Tag>}
                    </span>
                  </th>
                  <td>{d.slug}</td>
                  <td className={d.admin ? undefined : "text-secondary"}>{d.admin ?? p.adminPending}</td>
                  <td className="num">{d.users}</td>
                  <td>
                    <StatusBadge kind="division" value={d.status} params={{ step: d.step }} />
                  </td>
                  <td>{formatShortDate(zonedDay(d.createdAt))}</td>
                  <td>
                    {d.status === "ONBOARDING" ? (
                      <Link href={`/plateforme/divisions/nouvelle?division=${d.id}`} aria-label={t(p.resumeLabel, { name: d.name })}>{p.resume}</Link>
                    ) : (
                      <Link href={`/plateforme/divisions/${d.id}`} aria-label={t(p.manageLabel, { name: d.name })}>{p.manage}</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      <AuditLog path="/plateforme" {...audit} />
    </main>
  );
}
