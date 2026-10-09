// Gestion d'une division par l'admin plateforme (non maquetté) : identité, administrateur,
// suspension ou réactivation. Aucune donnée métier de la division n'est affichée.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Breadcrumb } from "@/components/ods/Navigation";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { getDivisionDetail } from "@/lib/data/platform";
import { requirePlatformAdmin } from "@/lib/data/viewer";
import { formatShortDate, zonedDay } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { DivisionState } from "./DivisionState";

export const metadata: Metadata = { title: dict.platform.title };

const p = dict.platform;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePlatformAdmin();
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();
  const d = await getDivisionDetail({ userId: viewer.userId, role: "PLATFORM_ADMIN" }, id);
  if (!d) notFound();
  if (d.status === "ONBOARDING") redirect(`/plateforme/divisions/nouvelle?division=${d.id}`);

  return (
    <main className="container ts-stack">
      <div className="ts-section" style={{ gap: 20 }}>
        <Breadcrumb items={[{ label: p.title, href: "/plateforme" }, { label: d.name }]} />
        <h1>{d.name}</h1>
      </div>
      <section className="card card-muted" aria-labelledby="identite-division" style={{ maxWidth: 600 }}>
        <h2 className="h5" id="identite-division">{p.facts}</h2>
        <dl className="ts-facts">
          <dt>{p.tenant}</dt>
          <dd>{d.slug}</dd>
          <dt>{p.direction}</dt>
          <dd>{d.direction}</dd>
          <dt>{p.admins}</dt>
          <dd>{d.admins.length ? d.admins.join(", ") : p.adminPending}</dd>
          <dt>{p.users}</dt>
          <dd>{d.users}</dd>
          <dt>{p.state}</dt>
          <dd><StatusBadge kind="division" value={d.status} params={{ step: d.step }} /></dd>
          <dt>{p.createdOn}</dt>
          <dd>{formatShortDate(zonedDay(d.createdAt))}</dd>
        </dl>
      </section>
      <DivisionState id={d.id} status={d.status} />
    </main>
  );
}
