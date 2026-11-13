// Formulaire de connexion (PROMPT.md §6, planches 01-Connexion et 01-Connexion-erreur).
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { dict } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { Button } from "@/shared/ui/Button";
import { Alert } from "@/shared/ui/Display";
import { CONTROL, FieldError } from "@/shared/ui/Form";
import { signInErrorOf, useSignIn, type SignInError } from "../api/mutations";

const t = dict.login;

type Fields = { email?: "vide" | "format"; password?: "vide" };

const MESSAGES = {
  email: { vide: t.emailEmpty, format: t.emailFormat },
  password: { vide: t.passwordEmpty },
} as const;

const LABEL = "required-mark mb-5 block font-bold";
const INPUT = cx(CONTROL, "h-control-lg rounded-lg text-lead");

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState<SignInError | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const signIn = useSignIn();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Champ vide à l'envoi : message sous le champ, focus sur le premier en erreur.
    const next: Fields = {};
    if (!email.trim()) next.email = "vide";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "format";
    if (!password) next.password = "vide";
    setFields(next);
    if (next.email || next.password) {
      (next.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setError(null);
    signIn.mutate(
      { email: email.trim(), password },
      {
        // Identifiants incorrects : l'adresse reste saisie, le mot de passe est vidé.
        onError: (err) => {
          setError(signInErrorOf(err));
          setPassword("");
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="titre-connexion" className="flex flex-col gap-20">
      {error && (
        <Alert tone="danger" role="alert" heading={t.errorTitle} onClose={() => setError(null)}>
          <p>{error === "tentatives" ? t.errorThrottled : t.errorCredentials}</p>
        </Alert>
      )}
      <p className="text-sm text-gray-595">{dict.form.requiredLegend}</p>
      <div>
        <label className={LABEL} htmlFor="email">
          {t.email}
        </label>
        <input
          ref={emailRef}
          className={INPUT}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          aria-required="true"
          aria-invalid={fields.email ? true : undefined}
          aria-describedby={fields.email ? "err-email" : undefined}
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {fields.email && <FieldError id="err-email">{MESSAGES.email[fields.email]}</FieldError>}
      </div>
      <div>
        <label className={LABEL} htmlFor="mdp">
          {t.password}
        </label>
        <div className="flex">
          <input
            ref={passwordRef}
            className={cx(INPUT, "min-w-0 flex-1 rounded-r-none border-r-0")}
            id="mdp"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            aria-required="true"
            aria-invalid={fields.password ? true : undefined}
            aria-describedby={fields.password ? "err-mdp" : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button size="lg" className="rounded-l-none" aria-pressed={visible} aria-controls="mdp" onClick={() => setVisible((v) => !v)}>
            {visible ? t.hide : t.show}
          </Button>
        </div>
        {fields.password && <FieldError id="err-mdp">{MESSAGES.password[fields.password]}</FieldError>}
      </div>
      <div className="flex justify-end">
        <Link className="flex min-h-control-lg items-center md:min-h-0" to="/mot-de-passe-oublie">
          {t.forgot}
        </Link>
      </div>
      <Button variant="primary" size="lg" type="submit" className="w-full" disabled={signIn.isPending}>
        {t.submit}
      </Button>
    </form>
  );
}
