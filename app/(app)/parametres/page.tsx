// Écran 14 : Paramètres, pour tous les rôles (PROMPT.md §9.11, planche 14-Parametres).
import type { Metadata } from "next";
import { getMySettings, NOTIFICATION_KINDS } from "@/lib/data/settings";
import { requireViewer } from "@/lib/data/viewer";
import { formatFrDate } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import type { NotificationKind } from "@/lib/notifications";
import { roleLabel } from "@/lib/viewer";
import { SettingsScreen, type SettingsView } from "./SettingsScreen";

export const metadata: Metadata = { title: dict.settings.title };

const s = dict.settings;

export default async function Page() {
  const viewer = await requireViewer();
  const me = await getMySettings({ userId: viewer.userId });
  const enters = viewer.permissions.includes("ENTER_TIME");
  // Notifications utiles au rôle : saisie et décisions pour qui saisit ; signature pour
  // le stagiaire et pour qui valide (superviseur).
  const relevant: Record<NotificationKind, boolean> = {
    fillReminder: enters,
    validated: enters,
    rejected: enters,
    signatureReminder: viewer.isIntern || viewer.permissions.includes("VALIDATE_TEAM"),
  };
  const account: Array<[string, string]> = [
    [s.name, me.name],
    [s.email, me.email],
    [s.role, roleLabel(me.role)],
  ];
  if (me.division) account.push([s.division, me.division]);
  if (me.manager) account.push([me.internship ? s.supervisor : s.manager, me.manager]);

  const view: SettingsView = {
    account,
    internship: me.internship
      ? [
          [s.kind, s.kinds[me.internship.kind]],
          [s.direction, me.internship.direction],
          [s.department, me.internship.department],
          [s.service, me.internship.service],
          [s.period, t(s.periodValue, { start: formatFrDate(me.internship.start), end: formatFrDate(me.internship.end) })],
        ]
      : null,
    reportHref: me.adminEmails.length ? `mailto:${me.adminEmails.join(",")}?subject=${encodeURIComponent(s.reportSubject)}` : null,
    hours: me.internship ? { arrival: me.usualArrival, departure: me.usualDeparture } : null,
    notifications: NOTIFICATION_KINDS.filter((k) => relevant[k]).map((kind) => ({ kind, enabled: me.notifications[kind] })),
    // Interface en français seulement (point 53).
    preferences: { locale: "fr", defaultSignatureMode: me.defaultSignatureMode, copyPreviousWeek: me.copyPreviousWeek },
    showCopyPreviousWeek: enters,
  };
  return <SettingsScreen view={view} />;
}
