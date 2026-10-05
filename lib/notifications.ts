// Préférences de notification (écran 14, jalon 6). Sans réglage, tout est actif.
export type NotificationKind = "fillReminder" | "validated" | "rejected" | "signatureReminder";

export function wantsNotification(prefs: unknown, kind: NotificationKind): boolean {
  if (typeof prefs !== "object" || prefs === null) return true;
  const value = (prefs as Record<string, unknown>)[kind];
  return value !== false;
}
