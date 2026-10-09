"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur des fiches de présence à signer et de leur détail : alerte et Réessayer.
export default function SupervisorAttendanceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.validation.title} heading={dict.attendance.errorTitle} text={dict.attendance.errorText} error={error} retry={retry} />;
}
