// Pages publiques (PROMPT.md §19, non maquettées) : mot de passe oublié, choix du mot de
// passe depuis un lien d'invitation ou de réinitialisation. Même cadre : barre noire avec
// le mot TimeSheet, contenu étroit. La réponse ne dit jamais si une adresse est connue.
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useLinkAccount, useRequestReset, useSetPasswordFromLink, type LinkKind } from "@/entities/settings";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Placeholder } from "@/shared/ui/Display";
import { RequiredLegend, TextField } from "@/shared/ui/Form";
import { Footer, Navbar } from "@/shared/ui/Navigation";

const a = dict.account;
const s = dict.settings;

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar href="/connexion" />
      <main className="mx-auto flex w-full max-w-modal flex-1 flex-col gap-30 px-20 py-30">
        <h1>{title}</h1>
        {children}
      </main>
      <Footer />
    </div>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  const request = useRequestReset();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError(a.errors.email);
      document.getElementById("adresse-reinitialisation")?.focus();
      return;
    }
    setError(null);
    request.mutate(email.trim(), { onSuccess: () => setSent(true), onError: () => setError(a.errors.email) });
  }

  return (
    <Frame title={a.forgotTitle}>
      {sent ? (
        <>
          <Alert tone="success" role="status">
            <p>{a.sent}</p>
          </Alert>
          <p>
            <Link to="/connexion">{a.backToLogin}</Link>
          </p>
        </>
      ) : (
        <>
          <p>{a.forgotIntro}</p>
          <form className="flex flex-col gap-20" onSubmit={onSubmit} noValidate>
            <TextField id="adresse-reinitialisation" label={a.email} type="email" autoComplete="email" required error={error} value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="flex flex-wrap items-center gap-20">
              <Button variant="primary" type="submit" disabled={request.isPending}>
                {a.sendLink}
              </Button>
              <Link to="/connexion">{a.backToLogin}</Link>
            </div>
          </form>
        </>
      )}
    </Frame>
  );
}

function Expired({ kind }: { kind: LinkKind }) {
  const invitation = kind === "invitation";
  return (
    <Alert tone="danger" role="alert" heading={a.invalidTitle}>
      <p>{invitation ? a.invalidInvite : a.invalidReset}</p>
      <p>
        <Link to={invitation ? "/connexion" : "/mot-de-passe-oublie"}>{invitation ? a.backToLogin : a.newRequest}</Link>
      </p>
    </Alert>
  );
}

function PasswordForm({ kind, token }: { kind: LinkKind; token: string }) {
  const save = useSetPasswordFromLink(kind, token);
  const navigate = useNavigate();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ next?: string; confirm?: string }>({});
  const [expired, setExpired] = useState(false);

  function fail(field: "next" | "confirm", text: string) {
    setErrors({ [field]: text });
    document.getElementById(field === "next" ? "nouveau-mot-de-passe" : "confirmation-mot-de-passe")?.focus();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.mutate(
      { next, confirm },
      {
        onSuccess: () => void navigate("/connexion?mot-de-passe=enregistre", { replace: true }),
        onError: (err) => {
          const body = err instanceof ApiError ? (err.body as { code?: string; fields?: string[] } | null) : null;
          const field = body?.fields?.[0];
          if (field === "passwordRules") fail("next", s.errors.passwordRules);
          else if (field === "passwordConfirm") fail("confirm", s.errors.passwordConfirm);
          else setExpired(true);
        },
      },
    );
  }

  if (expired) return <Expired kind={kind} />;
  return (
    <form className="flex flex-col gap-20" onSubmit={onSubmit} noValidate>
      <RequiredLegend />
      <TextField id="nouveau-mot-de-passe" label={s.newPassword} type="password" autoComplete="new-password" required hint={s.passwordRules} error={errors.next} value={next} onChange={(e) => setNext(e.target.value)} />
      <TextField id="confirmation-mot-de-passe" label={s.confirmPassword} type="password" autoComplete="new-password" required error={errors.confirm} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <Button variant="primary" type="submit" disabled={save.isPending}>
          {a.save}
        </Button>
      </div>
    </form>
  );
}

/** /invitation/:jeton et /reinitialisation/:jeton. */
export function LinkPasswordPage({ kind }: { kind: LinkKind }) {
  const { token = "" } = useParams();
  const account = useLinkAccount(kind, token);
  const invitation = kind === "invitation";
  return (
    <Frame title={invitation ? a.inviteTitle : a.resetTitle}>
      {account.isPending ? (
        <Placeholder className="h-pad w-full" />
      ) : account.isError ? (
        account.error instanceof ApiError && account.error.status === 404 ? (
          <Expired kind={kind} />
        ) : (
          <Alert tone="danger" role="alert" heading={a.invalidTitle} action={<Link className={buttonClass()} to="/connexion">{a.backToLogin}</Link>} />
        )
      ) : (
        <>
          <p>{invitation ? t(a.inviteIntro, { name: account.data.firstName, email: account.data.email }) : t(a.resetIntro, { email: account.data.email })}</p>
          <PasswordForm kind={kind} token={token} />
        </>
      )}
    </Frame>
  );
}
