"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de l'écran Projets (E4) : alerte et Réessayer.
export default function ProjectsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.project.title} heading={dict.project.errorTitle} text={dict.project.errorText} error={error} retry={retry} />;
}
