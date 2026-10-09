"use client";
// Onboarding d'une division (PROMPT.md §9.10, planche 13-Onboarding-division pour
// l'étape 2 ; étapes 1, 3, 4 et 5 non maquettées, §19). Chaque étape s'enregistre :
// « Continuer » passe à la suivante, « Enregistrer et quitter » revient à la liste.
import Link from "next/link";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { finishOnboardingStep, saveAdminStep, saveIdentityStep, saveRolesStep, saveRulesStep } from "@/app/actions/platform";
import { Alert } from "@/components/ods/Display";
import { Radio, RequiredLegend, TextField } from "@/components/ods/Form";
import { focusFirstRule, MatrixTable, RulesFields, WorkflowFields } from "@/components/ts/DivisionSettingsFields";
import { checkRules, checkWorkflow, type Matrix, type RulesErrors, type RulesInput, type WorkflowErrors, type WorkflowInput } from "@/lib/admin/rules";
import { dict } from "@/lib/i18n";
import { checkAdmin, checkIdentity, slugify, type AdminErrors, type AdminInput, type IdentityErrors, type IdentityInput } from "@/lib/onboarding/rules";

const o = dict.onboarding;

type Intent = "next" | "quit";

export type OnboardingView = {
  id: string | null;
  step: number;
  identity: IdentityInput;
  admin: AdminInput;
  matrix: Matrix;
  workflow: WorkflowInput;
  rules: RulesInput;
  summary: Array<{ n: number; title: string; rows: Array<[string, string]> }>;
  adminEmail: string;
};

const stepHref = (id: string | null, n: number) => (id ? `/plateforme/divisions/nouvelle?division=${id}&etape=${n}` : "/plateforme/divisions/nouvelle");

/** Pied de chaque étape, sous un filet noir : précédente, enregistrer et quitter, continuer. */
function Footer({ view, pending, onQuit, primary }: { view: OnboardingView; pending: boolean; onQuit?: () => void; primary: ReactNode }) {
  return (
    <div className="ts-submitbar" style={{ alignItems: "center" }}>
      {view.step > 1 ? <Link className="btn" href={stepHref(view.id, view.step - 1)}>{o.previous}</Link> : <span />}
      <div className="ts-head-start">
        {onQuit && (
          <button className="btn btn-link" type="button" onClick={onQuit} disabled={pending}>
            {o.saveQuit}
          </button>
        )}
        {primary}
      </div>
    </div>
  );
}

function Failure({ text }: { text: string | null }) {
  return text ? <Alert tone="danger" role="alert"><p>{text}</p></Alert> : null;
}

function focusFirst<E extends Record<string, string | undefined>>(errors: E, ids: Record<keyof E, string>) {
  const first = (Object.keys(ids) as Array<keyof E>).find((k) => errors[k]);
  if (first) document.getElementById(ids[first])?.focus();
}

// --- Étape 1 : identité ------------------------------------------------------------

function IdentityStep({ view }: { view: OnboardingView }) {
  const [v, setV] = useState(view.identity);
  const [slugTouched, setSlugTouched] = useState(Boolean(view.id));
  const [errors, setErrors] = useState<IdentityErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ids = { name: "division-nom", slug: "division-identifiant", direction: "division-rattachement" };

  function submit(how: Intent) {
    setFailure(null);
    const local = checkIdentity(v);
    setErrors(local);
    if (Object.keys(local).length) return focusFirst(local, ids);
    start(async () => {
      const r = await saveIdentityStep(view.id, v, how);
      if ("fields" in r) {
        setErrors(r.fields);
        focusFirst(r.fields, ids);
      } else setFailure(r.error);
    });
  }

  return (
    <form className="ts-section" onSubmit={(e: FormEvent) => { e.preventDefault(); submit("next"); }} noValidate>
      <h2 className="h3">{o.identityTitle}</h2>
      <RequiredLegend />
      <TextField id={ids.name} label={o.name} required autoComplete="off" value={v.name} error={errors.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value, slug: slugTouched ? x.slug : slugify(e.target.value) }))} />
      <TextField id={ids.slug} label={o.slug} required autoComplete="off" hint={o.slugHint} value={v.slug} error={errors.slug} onChange={(e) => { setSlugTouched(true); setV((x) => ({ ...x, slug: e.target.value })); }} />
      <TextField id={ids.direction} label={o.direction} required autoComplete="off" hint={o.directionHint} value={v.direction} error={errors.direction} onChange={(e) => setV((x) => ({ ...x, direction: e.target.value }))} />
      <Failure text={failure} />
      <Footer view={view} pending={pending} onQuit={() => submit("quit")} primary={<button className="btn btn-primary" type="submit" disabled={pending}>{o.next}</button>} />
    </form>
  );
}

// --- Étape 2 : administrateur (planche 13-Onboarding-division) ---------------------

function AdminStep({ view }: { view: OnboardingView }) {
  const [v, setV] = useState(view.admin);
  const [errors, setErrors] = useState<AdminErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ids = { fullName: "admin-nom", email: "admin-email" };

  function submit(how: Intent) {
    setFailure(null);
    const local = checkAdmin(v);
    setErrors(local);
    if (Object.keys(local).length) return focusFirst(local, ids);
    start(async () => {
      const r = await saveAdminStep(view.id!, v, how);
      if ("fields" in r) {
        setErrors(r.fields);
        focusFirst(r.fields, ids);
      } else setFailure(r.error);
    });
  }

  return (
    <form className="ts-section" onSubmit={(e: FormEvent) => { e.preventDefault(); submit("next"); }} noValidate>
      <h2 className="h3">{o.adminTitle}</h2>
      <RequiredLegend />
      <TextField id={ids.fullName} label={o.fullName} required autoComplete="off" value={v.fullName} error={errors.fullName} onChange={(e) => setV((x) => ({ ...x, fullName: e.target.value }))} />
      <TextField id={ids.email} label={o.email} type="email" required autoComplete="off" placeholder={o.emailPlaceholder} hint={o.emailHint} value={v.email} error={errors.email} onChange={(e) => setV((x) => ({ ...x, email: e.target.value }))} />
      <fieldset className="ts-section" style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        <legend className="h3" style={{ float: "none", padding: 0, marginBottom: 20 }}>{o.configTitle}</legend>
        <Radio name="configuration" label={o.copy} hint={o.copyHint} checked={v.config === "COPY"} onChange={() => setV((x) => ({ ...x, config: "COPY" }))} />
        <Radio name="configuration" label={o.blank} hint={o.blankHint} checked={v.config === "BLANK"} onChange={() => setV((x) => ({ ...x, config: "BLANK" }))} />
      </fieldset>
      <Failure text={failure} />
      <Footer view={view} pending={pending} onQuit={() => submit("quit")} primary={<button className="btn btn-primary" type="submit" disabled={pending}>{o.next}</button>} />
    </form>
  );
}

// --- Étape 3 : rôles et workflow ----------------------------------------------------

function RolesStep({ view }: { view: OnboardingView }) {
  const [matrix, setMatrix] = useState(view.matrix);
  const [w, setW] = useState(view.workflow);
  const [errors, setErrors] = useState<WorkflowErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(how: Intent) {
    setFailure(null);
    const local = checkWorkflow(w);
    setErrors(local);
    if (local.hrEmail) return document.getElementById("email-rh")?.focus();
    start(async () => {
      const r = await saveRolesStep(view.id!, matrix, w, how);
      if ("fields" in r) {
        setErrors(r.fields);
        document.getElementById("email-rh")?.focus();
      } else setFailure(r.error);
    });
  }

  return (
    <form className="ts-section" onSubmit={(e: FormEvent) => { e.preventDefault(); submit("next"); }} noValidate>
      <h2 className="h3">{o.rolesTitle}</h2>
      <p>{dict.admin.permissionsIntro}</p>
      <MatrixTable matrix={matrix} onChange={setMatrix} />
      <WorkflowFields value={w} errors={errors} onChange={(patch) => setW((x) => ({ ...x, ...patch }))} />
      <Failure text={failure} />
      <Footer view={view} pending={pending} onQuit={() => submit("quit")} primary={<button className="btn btn-primary" type="submit" disabled={pending}>{o.next}</button>} />
    </form>
  );
}

// --- Étape 4 : règles de saisie -----------------------------------------------------

function RulesStep({ view }: { view: OnboardingView }) {
  const [r, setR] = useState(view.rules);
  const [errors, setErrors] = useState<RulesErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(how: Intent) {
    setFailure(null);
    const local = checkRules(r);
    setErrors(local);
    if (Object.keys(local).length) return focusFirstRule(local);
    start(async () => {
      const res = await saveRulesStep(view.id!, r, how);
      if ("fields" in res) {
        setErrors(res.fields);
        focusFirstRule(res.fields);
      } else setFailure(res.error);
    });
  }

  return (
    <form className="ts-section" onSubmit={(e: FormEvent) => { e.preventDefault(); submit("next"); }} noValidate>
      <h2 className="h3">{o.rulesTitle}</h2>
      <RulesFields value={r} errors={errors} onChange={(patch) => setR((x) => ({ ...x, ...patch }))} />
      <Failure text={failure} />
      <Footer view={view} pending={pending} onQuit={() => submit("quit")} primary={<button className="btn btn-primary" type="submit" disabled={pending}>{o.next}</button>} />
    </form>
  );
}

// --- Étape 5 : récapitulatif ----------------------------------------------------------

export function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="ts-facts">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryStep({ view }: { view: OnboardingView }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    start(async () => {
      const r = await finishOnboardingStep(view.id!);
      setFailure(r.error);
    });
  }

  return (
    <form className="ts-section" onSubmit={create} noValidate>
      <h2 className="h3">{o.summaryTitle}</h2>
      <p>{o.summaryIntro.replace("{email}", view.adminEmail)}</p>
      {view.summary.map((s) => (
        <section key={s.n} className="card card-muted" aria-labelledby={`recap-${s.n}`}>
          <div className="ts-head">
            <h3 className="h5" id={`recap-${s.n}`}>{o.cardTitle.replace("{n}", String(s.n)).replace("{title}", s.title)}</h3>
            <Link href={stepHref(view.id, s.n)} aria-label={o.editStep.replace("{n}", String(s.n))}>{o.edit}</Link>
          </div>
          <Facts rows={s.rows} />
        </section>
      ))}
      <Failure text={failure} />
      <Footer view={view} pending={pending} primary={<button className="btn btn-primary" type="submit" disabled={pending}>{o.create}</button>} />
    </form>
  );
}

export function OnboardingForm({ view }: { view: OnboardingView }) {
  if (view.step === 1) return <IdentityStep view={view} />;
  if (view.step === 2) return <AdminStep view={view} />;
  if (view.step === 3) return <RolesStep view={view} />;
  if (view.step === 4) return <RulesStep view={view} />;
  return <SummaryStep view={view} />;
}
