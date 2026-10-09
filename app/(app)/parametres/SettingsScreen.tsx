"use client";
// Écran 14 : Paramètres (PROMPT.md §9.11, planche 14-Parametres). Une page à ancres ;
// chaque bloc s'enregistre seul. Les notifications changent tout de suite, avec « Annuler ».
import { useState, useTransition, type FormEvent } from "react";
import { changePasswordForm, saveHours, savePreferencesForm, toggleNotification, type SettingsError } from "@/app/actions/settings";
import { Alert, Card, ListGroup, ListGroupItem } from "@/components/ods/Display";
import { Radio, RadioGroup, RequiredLegend, SelectField, Switch, TextField } from "@/components/ods/Form";
import { checkNewPassword, isTime } from "@/lib/admin/rules";
import { dict, t } from "@/lib/i18n";
import type { NotificationKind } from "@/lib/notifications";

const s = dict.settings;

export type SettingsView = {
  account: Array<[string, string]>;
  internship: Array<[string, string]> | null;
  reportHref: string | null;
  hours: { arrival: string; departure: string } | null;
  notifications: Array<{ kind: NotificationKind; enabled: boolean }>;
  preferences: { locale: "fr" | "en"; defaultSignatureMode: "DRAWN" | "PASSWORD"; copyPreviousWeek: boolean };
  showCopyPreviousWeek: boolean;
};

type Notice = { text: string; undo?: () => void } | null;

const errorText = (code: SettingsError) => (code === "notFound" ? s.errors.unknown : s.errors[code]);

function Saved({ notice, onUndo }: { notice: Notice; onUndo?: () => void }) {
  if (!notice) return null;
  return (
    <Alert
      tone="success"
      role="status"
      action={notice.undo ? <button className="btn btn-link" type="button" onClick={onUndo}>{dict.form.undo}</button> : undefined}
    >
      <p>{notice.text}</p>
    </Alert>
  );
}

function Facts({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <Card muted>
      <h3 className="h5">{title}</h3>
      <dl className="ts-facts">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function HoursForm({ initial }: { initial: { arrival: string; departure: string } }) {
  const [arrival, setArrival] = useState(initial.arrival);
  const [departure, setDeparture] = useState(initial.departure);
  const [errors, setErrors] = useState<{ arrival?: string; departure?: string }>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setFailure(null);
    const next: typeof errors = {};
    if (!isTime(arrival)) next.arrival = s.errors.time;
    if (!isTime(departure)) next.departure = s.errors.time;
    else if (!next.arrival && departure.trim() <= arrival.trim()) next.departure = s.errors.order;
    setErrors(next);
    if (next.arrival || next.departure) {
      document.getElementById(next.arrival ? "heure-arrivee" : "heure-depart")?.focus();
      return;
    }
    start(async () => {
      const r = await saveHours(arrival, departure);
      if (r.ok) setNotice({ text: s.hoursSaved });
      else if (r.error === "time" || r.error === "order") setErrors({ departure: errorText(r.error) });
      else setFailure(errorText(r.error));
    });
  }

  return (
    <form className="ts-section" onSubmit={onSubmit} noValidate>
      <div className="ts-row-actions">
        <TextField id="heure-arrivee" label={s.arrival} required inputMode="numeric" value={arrival} error={errors.arrival} onChange={(e) => setArrival(e.target.value)} style={{ width: 160 }} aria-describedby="format-horaires" />
        <TextField id="heure-depart" label={s.departure} required inputMode="numeric" value={departure} error={errors.departure} onChange={(e) => setDeparture(e.target.value)} style={{ width: 160 }} aria-describedby="format-horaires" />
        <button className="btn" type="submit" disabled={pending}>
          {s.saveHours}
        </button>
      </div>
      <p className="form-text" id="format-horaires" style={{ marginTop: 0 }}>{s.hoursFormat}</p>
      <Saved notice={notice} />
      {failure && <Alert tone="danger" role="alert"><p>{failure}</p></Alert>}
    </form>
  );
}

function Notifications({ initial }: { initial: SettingsView["notifications"] }) {
  const [values, setValues] = useState(() => Object.fromEntries(initial.map((n) => [n.kind, n.enabled])) as Record<NotificationKind, boolean>);
  const [notice, setNotice] = useState<Notice>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function set(kind: NotificationKind, enabled: boolean, undoable = true) {
    setValues((v) => ({ ...v, [kind]: enabled }));
    setFailure(null);
    const r = await toggleNotification(kind, enabled);
    if (!r.ok) {
      setValues((v) => ({ ...v, [kind]: !enabled }));
      setNotice(null);
      setFailure(errorText(r.error));
      return;
    }
    const label = s.notifications[kind];
    setNotice(undoable ? { text: t(enabled ? s.notificationOn : s.notificationOff, { label }), undo: () => void set(kind, r.previous, false) } : { text: dict.admin.undone });
  }

  return (
    <div className="ts-section">
      <ListGroup>
        {initial.map(({ kind }) => (
          <ListGroupItem key={kind} style={{ minHeight: 60 }}>
            <span>{s.notifications[kind]}</span>
            <Switch label={s.notifications[kind]} checked={values[kind]} states={[s.on, s.off]} onChange={(e) => void set(kind, e.target.checked)} />
          </ListGroupItem>
        ))}
      </ListGroup>
      <Saved notice={notice} onUndo={() => { const u = notice?.undo; setNotice(null); u?.(); }} />
      {failure && <Alert tone="danger" role="alert"><p>{failure}</p></Alert>}
    </div>
  );
}

function PasswordForm() {
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ids = { current: "mot-de-passe-actuel", next: "nouveau-mot-de-passe", confirm: "confirmation-mot-de-passe" } as const;

  function fail(field: keyof typeof ids, message: string) {
    setErrors({ [field]: message });
    document.getElementById(ids[field])?.focus();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setFailure(null);
    if (!values.current) return fail("current", s.errors.currentPassword);
    const problem = checkNewPassword(values.next, values.confirm);
    if (problem) return fail(problem.field, problem.message);
    setErrors({});
    start(async () => {
      const r = await changePasswordForm(values.current, values.next, values.confirm);
      if (r.ok) {
        setValues({ current: "", next: "", confirm: "" });
        setNotice({ text: s.passwordChanged });
      } else if (r.error === "wrongPassword" || r.error === "currentPassword") {
        setValues((v) => ({ ...v, current: "" }));
        fail("current", errorText(r.error));
      } else if (r.error === "passwordRules" || r.error === "samePassword") fail("next", errorText(r.error));
      else if (r.error === "passwordConfirm") fail("confirm", errorText(r.error));
      else setFailure(errorText(r.error));
    });
  }

  const field = (key: keyof typeof ids) => ({
    id: ids[key],
    type: "password",
    required: true,
    value: values[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  return (
    <form className="ts-section" onSubmit={onSubmit} noValidate style={{ maxWidth: 480 }}>
      <RequiredLegend />
      <TextField label={s.currentPassword} autoComplete="current-password" {...field("current")} />
      <TextField label={s.newPassword} autoComplete="new-password" hint={s.passwordRules} {...field("next")} />
      <TextField label={s.confirmPassword} autoComplete="new-password" {...field("confirm")} />
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {s.changePassword}
        </button>
      </div>
      <Saved notice={notice} />
      {failure && <Alert tone="danger" role="alert"><p>{failure}</p></Alert>}
    </form>
  );
}

function PreferencesForm({ initial, showCopy }: { initial: SettingsView["preferences"]; showCopy: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [notice, setNotice] = useState<Notice>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setFailure(null);
    start(async () => {
      const r = await savePreferencesForm(values);
      if (r.ok) {
        setSaved(values);
        setNotice({ text: s.preferencesSaved });
      } else setFailure(errorText(r.error));
    });
  }

  return (
    <form className="ts-section" onSubmit={onSubmit} noValidate>
      <div className="ts-form-grid">
        <SelectField label={s.language} hint={s.languageUnavailable} value={values.locale} onChange={(e) => setValues((v) => ({ ...v, locale: e.target.value === "en" ? "en" : "fr" }))}>
          <option value="fr">{s.languages.fr}</option>
          <option value="en" disabled>{s.languages.en}</option>
        </SelectField>
        <RadioGroup legend={s.signatureMode}>
          {(["DRAWN", "PASSWORD"] as const).map((m) => (
            <Radio key={m} name="mode-signature" label={s.modes[m]} checked={values.defaultSignatureMode === m} onChange={() => setValues((v) => ({ ...v, defaultSignatureMode: m }))} />
          ))}
        </RadioGroup>
        {showCopy && (
          <Switch label={s.copyPreviousWeek} text={s.copyPreviousWeek} checked={values.copyPreviousWeek} onChange={(e) => setValues((v) => ({ ...v, copyPreviousWeek: e.target.checked }))} />
        )}
      </div>
      <div className="ts-actions">
        <button className="btn" type="button" disabled={!dirty || pending} onClick={() => { setValues(saved); setNotice(null); }}>
          {s.cancel}
        </button>
        <button className="btn" type="submit" disabled={pending}>
          {s.savePreferences}
        </button>
      </div>
      <Saved notice={notice} />
      {failure && <Alert tone="danger" role="alert"><p>{failure}</p></Alert>}
    </form>
  );
}

export function SettingsScreen({ view }: { view: SettingsView }) {
  const sections = [
    { id: "profil", title: view.internship ? s.profileTitle : s.profileTitleStaff },
    ...(view.hours ? [{ id: "horaires", title: s.hoursTitle }] : []),
    ...(view.notifications.length ? [{ id: "notifications", title: s.notificationsTitle }] : []),
    { id: "securite", title: s.securityTitle },
    { id: "preferences", title: s.preferencesTitle },
  ];

  return (
    <main className="container ts-stack">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1>{s.title}</h1>
        <p className="text-secondary">{s.intro}</p>
      </div>
      <nav className="ts-anchors" aria-labelledby="sur-cette-page">
        <p id="sur-cette-page">{s.onThisPage}</p>
        {sections.map((sec) => (
          <a key={sec.id} href={`#${sec.id}`}>{sec.title}</a>
        ))}
      </nav>

      <section id="profil" aria-labelledby="titre-profil" className="ts-section">
        <h2 id="titre-profil">{sections[0]!.title}</h2>
        <div className="ts-cards-2">
          <Facts title={s.accountCard} rows={view.account} />
          {view.internship && <Facts title={s.internshipCard} rows={view.internship} />}
        </div>
        <p className="small text-secondary">
          {s.managedBy}
          {view.reportHref && (
            <>
              {" "}
              <a href={view.reportHref} className="fw-bold">{s.reportError}</a>
            </>
          )}
        </p>
      </section>

      {view.hours && (
        <section id="horaires" aria-labelledby="titre-horaires" className="ts-section">
          <h2 id="titre-horaires">{s.hoursTitle}</h2>
          <p>{s.hoursIntro}</p>
          <HoursForm initial={view.hours} />
        </section>
      )}

      {view.notifications.length > 0 && (
        <section id="notifications" aria-labelledby="titre-notifications" className="ts-section">
          <h2 id="titre-notifications">{s.notificationsTitle}</h2>
          <Notifications initial={view.notifications} />
        </section>
      )}

      <section id="securite" aria-labelledby="titre-securite" className="ts-section">
        <h2 id="titre-securite">{s.securityTitle}</h2>
        <PasswordForm />
      </section>

      <section id="preferences" aria-labelledby="titre-preferences" className="ts-section">
        <h2 id="titre-preferences">{s.preferencesTitle}</h2>
        <PreferencesForm initial={view.preferences} showCopy={view.showCopyPreviousWeek} />
      </section>
    </main>
  );
}
