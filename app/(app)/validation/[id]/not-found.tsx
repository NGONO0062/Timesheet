import Link from "next/link";
import { Alert } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

// Écran 8, état d'erreur (E4) : « Cette fiche n'existe plus ou a déjà été traitée », retour à la file.
export default function ReviewNotFound() {
  return (
    <main className="container ts-stack">
      <h1>{dict.validation.title}</h1>
      <Alert tone="danger" role="alert" heading={dict.validation.goneTitle}>
        <p>{dict.validation.goneText}</p>
        <div>
          <Link className="btn" href="/validation">{dict.validation.backToQueue}</Link>
        </div>
      </Alert>
    </main>
  );
}
