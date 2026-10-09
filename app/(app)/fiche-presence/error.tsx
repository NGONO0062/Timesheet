"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de la fiche de présence (E4) : alerte et Réessayer.
export default function AttendanceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.attendance.title} heading={dict.attendance.errorTitle} text={dict.attendance.errorText} error={error} retry={retry} />;
}
