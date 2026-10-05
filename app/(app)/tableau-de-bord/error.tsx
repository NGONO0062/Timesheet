"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur du tableau de bord (E4) : alerte en tête de page, les cartes sans données sont masquées.
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.dashboard.title} heading={dict.dashboard.errorTitle} text={dict.dashboard.errorText} error={error} retry={retry} />;
}
