"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de chargement de la saisie (E4). La sauvegarde automatique a son propre message.
export default function EntryError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.entry.title} heading={dict.entry.errorTitle} text={dict.entry.errorText} error={error} retry={retry} />;
}
