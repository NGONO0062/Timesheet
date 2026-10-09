// Signature du superviseur (PROMPT.md §19) : mise en page de l'écran 06, côté manager.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { now } from "@/lib/clock";
import { getSupervisedSheet } from "@/lib/data/attendance";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { dict } from "@/lib/i18n";
import { AttendanceScreen } from "../../../fiche-presence/AttendanceScreen";
import { supervisorScreen } from "../../../fiche-presence/view";

export const metadata: Metadata = { title: dict.attendance.supervisorTitle };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("VALIDATE_TEAM");
  const { id } = await params;
  const sheet = await getSupervisedSheet(scopeOf(viewer), id);
  if (!sheet) notFound();
  return <AttendanceScreen view={supervisorScreen(sheet, viewer, now())} />;
}
