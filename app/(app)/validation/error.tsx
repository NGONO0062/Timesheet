"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de la file (E3) : « Les fiches n'ont pas pu être chargées », Réessayer.
export default function QueueError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.validation.title} heading={dict.validation.errorTitle} text={dict.validation.errorText} error={error} retry={retry} />;
}
