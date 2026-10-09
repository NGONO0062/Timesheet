"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de l'administration (E4) : alerte et Réessayer.
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.admin.title} heading={dict.admin.errorTitle} text={dict.admin.errorText} error={error} retry={retry} />;
}
