// Écran 6 : ma fiche de présence RH (PROMPT.md §9.7, §9.8, planche 06-Fiche-RH).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ods/Navigation";
import { EmptyState } from "@/components/ts/States";
import { monthLabel } from "@/lib/attendance/sheet";
import { now } from "@/lib/clock";
import { getMySheet, listMySheets } from "@/lib/data/attendance";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { dict, t } from "@/lib/i18n";
import { attendanceHref } from "@/lib/routes";
import { AttendanceScreen } from "../../AttendanceScreen";
import { internScreen } from "../../view";

export const metadata: Metadata = { title: dict.attendance.title };

const a = dict.attendance;

export default async function Page({ params }: { params: Promise<{ annee: string; mois: string }> }) {
  const viewer = await requirePermission("ENTER_TIME");
  const { annee, mois } = await params;
  if (!/^\d{4}$/.test(annee) || !/^(1[0-2]|[1-9])$/.test(mois)) notFound();
  const year = Number(annee);
  const month = Number(mois);
  const scope = scopeOf(viewer);
  const [sheet, sheets] = await Promise.all([getMySheet(scope, year, month), listMySheets(scope)]);
  const periods = sheets.map((s) => ({ href: attendanceHref(s.year, s.month), label: monthLabel(s.year, s.month) }));

  if (!sheet) {
    return (
      <main className="container ts-stack">
        <Breadcrumb items={[{ label: dict.dashboard.title, href: "/tableau-de-bord" }, { label: a.navLabel }]} />
        <h1>{a.title}</h1>
        <EmptyState headingLevel={2} title={t(a.notReadyTitle, { month: monthLabel(year, month).toLowerCase() })}>
          {a.notReadyText}
        </EmptyState>
      </main>
    );
  }
  return <AttendanceScreen view={internScreen(sheet, viewer, now(), periods, attendanceHref(year, month))} />;
}
