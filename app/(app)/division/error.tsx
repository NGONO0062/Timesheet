"use client";
import { ScreenError } from "@/components/ts/ScreenError";
import { dict } from "@/lib/i18n";

// Erreur de la vue division (E4), quand la division elle-même ne se charge pas ;
// les autres pannes s'affichent bloc par bloc dans la page.
export default function DivisionError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ScreenError title={dict.division.screenTitle} heading={dict.division.errorTitle} text={dict.division.errorText} error={error} retry={retry} />;
}
