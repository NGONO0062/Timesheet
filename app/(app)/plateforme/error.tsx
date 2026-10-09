"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de l'administration plateforme (E4) : alerte et Réessayer.
export default function PlatformError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.platform.title} heading={dict.platform.errorTitle} text={dict.platform.errorText} error={error} retry={retry} />;
}
