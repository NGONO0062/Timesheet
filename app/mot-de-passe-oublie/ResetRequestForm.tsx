"use client";
// Demande de réinitialisation (PROMPT.md §19, non maquetté). La réponse est la même que
// l'adresse corresponde à un compte ou non.
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { requestPasswordReset } from "@/app/actions/account";
import { Alert } from "@/components/ods/Display";
import { TextField } from "@/components/ods/Form";
import { isEmail } from "@/lib/admin/rules";
import { dict } from "@/lib/i18n";

const a = dict.account;

export function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isEmail(email)) {
      setError(a.errors.email);
      document.getElementById("adresse-reinitialisation")?.focus();
      return;
    }
    setError(null);
    start(async () => {
      const r = await requestPasswordReset(email);
      if (r.ok) setSent(true);
      else setError(a.errors.email);
    });
  }

  if (sent) {
    return (
      <>
        <Alert tone="success" role="status">
          <p>{a.sent}</p>
        </Alert>
        <p>
          <Link href="/connexion">{a.backToLogin}</Link>
        </p>
      </>
    );
  }

  return (
    <form className="ts-stack" style={{ gap: 20 }} onSubmit={onSubmit} noValidate>
      <TextField
        id="adresse-reinitialisation"
        label={a.email}
        type="email"
        autoComplete="email"
        required
        error={error}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {a.sendLink}
        </button>
        <Link href="/connexion">{a.backToLogin}</Link>
      </div>
    </form>
  );
}
