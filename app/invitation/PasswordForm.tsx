"use client";
// Choix du mot de passe depuis un lien à usage unique : invitation ou réinitialisation
// (PROMPT.md §19, non maquetté). Erreur sous le champ, focus sur le champ en erreur (§5.5).
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { setPasswordFromLink } from "@/app/actions/account";
import { Alert } from "@/components/ods/Display";
import { RequiredLegend, TextField } from "@/components/ods/Form";
import { checkNewPassword } from "@/lib/admin/rules";
import { dict } from "@/lib/i18n";

const a = dict.account;
const s = dict.settings;

export function PasswordForm({ kind, token }: { kind: "INVITATION" | "RESET"; token: string }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ next?: string; confirm?: string }>({});
  const [expired, setExpired] = useState(false);
  const [pending, start] = useTransition();

  function fail(field: "next" | "confirm", message: string) {
    setErrors({ [field]: message });
    document.getElementById(field === "next" ? "nouveau-mot-de-passe" : "confirmation-mot-de-passe")?.focus();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = checkNewPassword(next, confirm);
    if (problem) return fail(problem.field, problem.message);
    setErrors({});
    start(async () => {
      const r = await setPasswordFromLink(kind, token, next, confirm);
      if ("expired" in r) setExpired(true);
      else fail(r.field, r.message);
    });
  }

  if (expired) {
    return (
      <Alert tone="danger" role="alert" heading={a.invalidTitle}>
        <p>{kind === "INVITATION" ? a.invalidInvite : a.invalidReset}</p>
        <p>
          <Link href={kind === "INVITATION" ? "/connexion" : "/mot-de-passe-oublie"}>{kind === "INVITATION" ? a.backToLogin : a.newRequest}</Link>
        </p>
      </Alert>
    );
  }

  return (
    <form className="ts-stack" style={{ gap: 20 }} onSubmit={onSubmit} noValidate>
      <RequiredLegend />
      <TextField
        id="nouveau-mot-de-passe"
        label={s.newPassword}
        type="password"
        autoComplete="new-password"
        required
        hint={s.passwordRules}
        error={errors.next}
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <TextField
        id="confirmation-mot-de-passe"
        label={s.confirmPassword}
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirm}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {a.save}
        </button>
      </div>
    </form>
  );
}
