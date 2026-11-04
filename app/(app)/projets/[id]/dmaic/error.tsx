"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de chargement du suivi DMAIC (E3) : alerte et Réessayer.
export default function FollowUpError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.dmaic.title} heading={dict.dmaic.errorTitle} text={dict.dmaic.errorText} error={error} retry={retry} />;
}
