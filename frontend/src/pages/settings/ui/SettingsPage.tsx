// Écran 14 : Paramètres, pour tous les rôles (PROMPT.md §9.11, planche 14-Parametres).
// Une page à ancres ; chaque bloc s'enregistre seul. Les notifications changent tout de
// suite, avec « Annuler ». Aucun bouton primaire : chaque bloc a son propre enregistrement.
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  useChangePassword,
  useSettings,
  useToggleNotification,
  type NotificationKind,
  type Settings,
} from "@/entities/settings";
import { roleLabel, VIEWER_KEY, type Role } from "@/entities/viewer";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { Button } from "@/shared/ui/Button";
import { Alert, Card, ListGroup, ListGroupItem, Placeholder } from "@/shared/ui/Display";
import { RequiredLegend, SelectField, Switch, TextField } from "@/shared/ui/Form";
import { AnchorNav } from "@/shared/ui/Navigation";

const s = dict.settings;

type SettingsErrorKey = keyof typeof s.errors;

/** Code d'erreur de l'API (422, 401) et champs en erreur. */
function ruleOf(e: unknown): { code: string; fields: string[] } {
  if (e instanceof ApiError) {
    if (e.status === 401) return { code: "session", fields: [] };
    const body = e.body as { code?: string; fields?: string[] } | null;
    if (body?.code) return { code: body.code, fields: body.fields ?? [] };
  }
  return { code: "unknown", fields: [] };
}

const message = (code: string) => (code in s.errors ? s.errors[code as SettingsErrorKey] : s.errors.unknown);

type Notice = { text: string; undo?: () => void } | null;

function Saved({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  if (!notice) return null;
  return (
    <Alert
      tone="success"
      role="status"
      onClose={onClose}
      action={
        notice.undo ? (
          <Button
            variant="link"
            onClick={() => {
              const undo = notice.undo;
              onClose();
              undo?.();
            }}
          >
            {dict.form.undo}
          </Button>
        ) : undefined
      }
    >
      <p>{notice.text}</p>
    </Alert>
  );
}

function Failure({ text, onClose }: { text: string | null; onClose: () => void }) {
  if (!text) return null;
  return (
    <Alert tone="danger" role="alert" onClose={onClose}>
      <p>{text}</p>
    </Alert>
  );
}

function Facts({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <Card muted>
      <h3 className="text-h5">{title}</h3>
      <dl className="grid grid-cols-trace gap-x-20 gap-y-10">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-595">{k}</dt>
            <dd className="font-bold wrap-anywhere">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Notifications({ initial }: { initial: Settings["notifications"] }) {
  const toggle = useToggleNotification();
  const [values, setValues] = useState(() => Object.fromEntries(initial.map((n) => [n.kind, n.enabled])) as Record<NotificationKind, boolean>);
  const [notice, setNotice] = useState<Notice>(null);
  const [failure, setFailure] = useState<string | null>(null);

  function set(kind: NotificationKind, enabled: boolean, undoable = true) {
    setValues((v) => ({ ...v, [kind]: enabled }));
    setFailure(null);
    toggle.mutate(
      { kind, enabled },
      {
        onSuccess: (r) => {
          const label = s.notifications[kind];
          setNotice(undoable ? { text: t(enabled ? s.notificationOn : s.notificationOff, { label }), undo: () => set(kind, r.previous, false) } : { text: dict.admin.undone });
        },
        onError: (err) => {
          setValues((v) => ({ ...v, [kind]: !enabled }));
          setNotice(null);
          setFailure(message(ruleOf(err).code));
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-20">
      <ListGroup>
        {initial.map(({ kind }) => (
          <ListGroupItem key={kind} className="min-h-60">
            <span>{s.notifications[kind]}</span>
            <Switch label={s.notifications[kind]} checked={values[kind]} states={[s.on, s.off]} onChange={(e) => set(kind, e.target.checked)} />
          </ListGroupItem>
        ))}
      </ListGroup>
      <Saved notice={notice} onClose={() => setNotice(null)} />
      <Failure text={failure} onClose={() => setFailure(null)} />
    </div>
  );
}

const PASSWORD_IDS = { current: "mot-de-passe-actuel", next: "nouveau-mot-de-passe", confirm: "confirmation-mot-de-passe" } as const;

function PasswordForm() {
  const change = useChangePassword();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof PASSWORD_IDS, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);

  function fail(field: keyof typeof PASSWORD_IDS, text: string) {
    setErrors({ [field]: text });
    document.getElementById(PASSWORD_IDS[field])?.focus();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFailure(null);
    if (!values.current) return fail("current", s.errors.currentPassword);
    change.mutate(values, {
      // Toutes les sessions du compte sont fermées, celle-ci comprise : retour à la connexion.
      // La page de connexion d'abord, puis l'oubli de l'utilisateur : sinon la garde des pages
      // protégées redirige vers « /connexion » sans le message.
      onSuccess: () => {
        void navigate("/connexion?mot-de-passe=modifie", { replace: true });
        client.clear();
        client.setQueryData(VIEWER_KEY, null);
      },
      onError: (err) => {
        const rule = ruleOf(err);
        const field = rule.fields[0];
        if (rule.code === "wrongPassword" || rule.code === "currentPassword") setValues((v) => ({ ...v, current: "" }));
        if (field === "current" || field === "next" || field === "confirm") fail(field, message(rule.code));
        else setFailure(message(rule.code));
      },
    });
  }

  const field = (key: keyof typeof PASSWORD_IDS) => ({
    id: PASSWORD_IDS[key],
    type: "password",
    required: true,
    value: values[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  return (
    <form className="flex max-w-form flex-col gap-20" onSubmit={onSubmit} noValidate>
      <RequiredLegend />
      <TextField label={s.currentPassword} autoComplete="current-password" {...field("current")} />
      <TextField label={s.newPassword} autoComplete="new-password" hint={s.passwordRules} {...field("next")} />
      <TextField label={s.confirmPassword} autoComplete="new-password" {...field("confirm")} />
      <div>
        <Button type="submit" disabled={change.isPending}>
          {s.changePassword}
        </Button>
      </div>
      <Failure text={failure} onClose={() => setFailure(null)} />
    </form>
  );
}

/** Interface en français seulement pour l'instant (questions ouvertes, point 53) : rien à enregistrer. */
function LanguageField() {
  return (
    <div className="grid gap-20 md:grid-cols-3">
      <SelectField label={s.language} hint={s.languageUnavailable} value="fr" onChange={() => undefined}>
        <option value="fr">{s.languages.fr}</option>
        <option value="en" disabled>
          {s.languages.en}
        </option>
      </SelectField>
    </div>
  );
}

function Loaded({ me }: { me: Settings }) {
  const account: Array<[string, string]> = [
    [s.name, me.name],
    [s.email, me.email],
    [s.role, roleLabel(me.role as Role)],
  ];
  if (me.division) account.push([s.division, me.division]);
  if (me.manager) account.push([s.manager, me.manager]);
  const reportHref = me.adminEmails.length ? `mailto:${me.adminEmails.join(",")}?subject=${encodeURIComponent(s.reportSubject)}` : null;
  const sections = [
    { id: "profil", label: s.profileTitle },
    ...(me.notifications.length ? [{ id: "notifications", label: s.notificationsTitle }] : []),
    { id: "securite", label: s.securityTitle },
    { id: "preferences", label: s.preferencesTitle },
  ];

  return (
    <main className="flex flex-col gap-60">
      <div className="flex flex-col gap-20">
        <div className="flex flex-col gap-10">
          <h1>{s.title}</h1>
          <p className="text-gray-595">{s.intro}</p>
        </div>
        <AnchorNav label={s.onThisPage} items={sections} />
      </div>

      <section id="profil" aria-labelledby="titre-profil" className="flex scroll-mt-20 flex-col gap-20">
        <h2 id="titre-profil">{s.profileTitle}</h2>
        <div className="grid gap-20 md:grid-cols-2">
          <Facts title={s.accountCard} rows={account} />
        </div>
        <p className="text-sm text-gray-595">
          {s.managedBy}
          {reportHref && (
            <>
              {" "}
              <a href={reportHref}>{s.reportError}</a>
            </>
          )}
        </p>
      </section>

      {me.notifications.length > 0 && (
        <section id="notifications" aria-labelledby="titre-notifications" className="flex scroll-mt-20 flex-col gap-20">
          <h2 id="titre-notifications">{s.notificationsTitle}</h2>
          <Notifications initial={me.notifications} />
        </section>
      )}

      <section id="securite" aria-labelledby="titre-securite" className="flex scroll-mt-20 flex-col gap-20">
        <h2 id="titre-securite">{s.securityTitle}</h2>
        <PasswordForm />
      </section>

      <section id="preferences" aria-labelledby="titre-preferences" className="flex scroll-mt-20 flex-col gap-20">
        <h2 id="titre-preferences">{s.preferencesTitle}</h2>
        <LanguageField />
      </section>
    </main>
  );
}

export function SettingsPage() {
  const query = useSettings();
  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <h1>{s.title}</h1>
        <p className="sr-only" role="status">
          {s.loading}
        </p>
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="flex flex-col gap-30">
        <h1>{s.title}</h1>
        <Alert tone="danger" role="alert" heading={s.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
          <p>{s.errorText}</p>
        </Alert>
      </main>
    );
  }
  return <Loaded me={query.data} />;
}
