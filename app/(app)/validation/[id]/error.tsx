"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de chargement du détail d'une fiche (E3) : alerte et Réessayer. Une fiche
// introuvable ou déjà traitée a son propre état (not-found.tsx).
export default function ReviewError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.validation.title} heading={dict.validation.errorTitle} text={dict.validation.errorText} error={error} retry={retry} />;
}
