"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de l'écran Paramètres : alerte et Réessayer.
export default function SettingsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.settings.title} heading={dict.settings.errorTitle} text={dict.settings.errorText} error={error} retry={retry} />;
}
