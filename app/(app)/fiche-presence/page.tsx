import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ts/States";
import { listMySheets } from "@/lib/data/attendance";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { dict } from "@/lib/i18n";
import { attendanceHref } from "@/lib/routes";

export const metadata: Metadata = { title: dict.attendance.title };

const a = dict.attendance;

// Lien de navigation « Fiche de présence » : la fiche à signer d'abord, sinon la plus récente.
export default async function Page() {
  const viewer = await requirePermission("ENTER_TIME");
  const sheets = await listMySheets(scopeOf(viewer));
  const target = sheets.find((s) => s.status === "GENERATED") ?? sheets[0];
  if (target) redirect(attendanceHref(target.year, target.month));
  return (
    <main className="container ts-stack">
      <h1>{a.title}</h1>
      <EmptyState headingLevel={2} title={a.emptyTitle} actions={<Link className="btn" href="/saisie">{a.emptyAction}</Link>}>
        {a.emptyText}
      </EmptyState>
    </main>
  );
}
