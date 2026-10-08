"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur du reporting (E4) : alerte et Réessayer, export désactivé.
export default function ReportingError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.reporting.title} heading={dict.reporting.errorTitle} text={dict.reporting.errorText} error={error} retry={retry} />;
}
