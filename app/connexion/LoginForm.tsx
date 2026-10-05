"use client";
// Formulaire de connexion (PROMPT.md §6, planches 01-Connexion et 01-Connexion-erreur).
import Link from "next/link";
import { useActionState, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ods/Display";
import { FieldError } from "@/components/ods/Form";
import { cx } from "@/lib/cx";
import { dict } from "@/lib/i18n";
import { login, type LoginState } from "@/app/actions/auth";

const t = dict.login;

const FIELD_MESSAGES = {
  email: { vide: t.emailEmpty, format: t.emailFormat },
  password: { vide: t.passwordEmpty },
} as const;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [local, setLocal] = useState<LoginState["fields"]>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState(async (prev: LoginState, data: FormData) => {
    const result = await login(prev, data);
    // Identifiants incorrects : l'adresse reste saisie, le mot de passe est vidé.
    if (result.error || result.fields) setPassword("");
    if (result.fields?.email) emailRef.current?.focus();
    else if (result.fields?.password) passwordRef.current?.focus();
    return result;
  }, {});

  const fields = { ...state.fields, ...local };

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Champ vide à l'envoi : message sous le champ, focus sur le premier en erreur.
    const next: LoginState["fields"] = {};
    if (!email.trim()) next.email = "vide";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "format";
    if (!password) next.password = "vide";
    setLocal(next);
    if (next.email || next.password) {
      e.preventDefault();
      (next.email ? emailRef : passwordRef).current?.focus();
    }
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate aria-labelledby="titre-connexion" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {state.error && (
        <Alert tone="danger" role="alert" heading={t.errorTitle}>
          <p>{state.error === "tentatives" ? t.errorThrottled : t.errorCredentials}</p>
        </Alert>
      )}
      <p className="small text-secondary">{dict.form.requiredLegend}</p>
      <div>
        <label className="form-label is-required" htmlFor="email">
          {t.email}
        </label>
        <input
          ref={emailRef}
          className={cx("form-control form-control-lg", fields.email && "is-invalid")}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          aria-required="true"
          aria-invalid={fields.email ? true : undefined}
          aria-describedby="err-email"
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div id="err-email">{fields.email && <FieldError id="err-email-texte">{FIELD_MESSAGES.email[fields.email]}</FieldError>}</div>
      </div>
      <div>
        <label className="form-label is-required" htmlFor="mdp">
          {t.password}
        </label>
        <div className="input-group">
          <input
            ref={passwordRef}
            className={cx("form-control form-control-lg", fields.password && "is-invalid")}
            id="mdp"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            aria-required="true"
            aria-invalid={fields.password ? true : undefined}
            aria-describedby="err-mdp"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn btn-lg" type="button" aria-pressed={visible} aria-controls="mdp" onClick={() => setVisible((v) => !v)}>
            {visible ? t.hide : t.show}
          </button>
        </div>
        <div id="err-mdp">{fields.password && <FieldError id="err-mdp-texte">{FIELD_MESSAGES.password[fields.password]}</FieldError>}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link className="ts-login-forgot" href="/mot-de-passe-oublie">
          {t.forgot}
        </Link>
      </div>
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={pending}>
        {t.submit}
      </button>
    </form>
  );
}
