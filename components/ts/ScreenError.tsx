"use client";
// État d'erreur d'un écran (planche E3) : ce qui s'est passé, ce qui est préservé,
// quoi faire, et un bouton Réessayer.
import { useEffect, useState } from "react";
import { Alert } from "@/components/ods/Display";
import { formatDateAt } from "@/lib/format";
import { dict } from "@/lib/i18n";

export function ScreenError({ title, heading, text, error, retry }: {
  title: string;
  heading: string;
  text: string;
  error: Error;
  retry: () => void;
}) {
  // Heure de la tentative : fixée au montage, côté navigateur.
  const [at] = useState(() => formatDateAt(new Date()));
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="container ts-stack">
      <h1>{title}</h1>
      <Alert tone="danger" role="alert" heading={heading}>
        <p>{text}</p>
        <p className="small text-secondary">{`${dict.errors.lastAttempt} ${at}. ${dict.dashboard.errorHelp}`}</p>
        <div>
          <button className="btn" type="button" onClick={retry}>
            {dict.form.retry}
          </button>
        </div>
      </Alert>
    </main>
  );
}
