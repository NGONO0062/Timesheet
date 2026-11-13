// Écran 13 : onboarding d'une division (PROMPT.md §9.10, planche 13-Onboarding-division pour
// l'étape 2 ; étapes 1, 3, 4 et 5 non maquettées, §19). Chaque étape s'enregistre :
// « Continuer » passe à la suivante, « Enregistrer et quitter » revient à la liste.
// Sans `division`, l'étape 1 crée l'onboarding ; `etape` ne dépasse jamais la progression.
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { DEFAULT_MATRIX, fieldMessages, matrixChanges, type Matrix, type Rules, type Workflow } from "@/entities/admin";
import { slugify, useOnboarding, useOnboardingSteps, type Identity, type Onboarding, type OnboardingAdmin } from "@/entities/platform";
import { roleLabel } from "@/entities/viewer";
import { focusFirstRule, MatrixTable, RulesFields, WorkflowFields, type FieldErrors } from "@/features/division-settings";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Card, Placeholder } from "@/shared/ui/Display";
import { Radio, RequiredLegend, TextField } from "@/shared/ui/Form";
import { Breadcrumb, SteppedProcess } from "@/shared/ui/Navigation";

const o = dict.onboarding;
const a = dict.admin;

type Intent = "next" | "quit";

type View = {
  id: string | null;
  step: number;
  identity: Identity;
  admin: OnboardingAdmin;
  matrix: Matrix;
  workflow: Workflow;
  rules: Rules;
  summary: Array<{ n: number; title: string; rows: Array<[string, string]> }>;
};

const NEW: View = {
  id: null,
  step: 1,
  identity: { name: "", slug: "", direction: "" },
  admin: { fullName: "", email: "", config: "COPY" },
  matrix: DEFAULT_MATRIX,
  workflow: { ownerValidation: false, reminderAfterWorkingDays: 3, delegateToOwner: true },
  rules: { workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], deadlineDay: "FRIDAY", deadlineTime: "18:00", fillAlertThreshold: "80", allowFutureWeeks: false, lockAfterValidation: true },
  summary: [],
};

function viewOf(ob: Onboarding, step: number): View {
  const changes = matrixChanges(ob.matrix);
  const r = ob.rules;
  return {
    id: ob.id,
    step,
    identity: ob.identity,
    admin: ob.admin ?? { fullName: "", email: "", config: "COPY" },
    matrix: ob.matrix,
    workflow: ob.workflow,
    rules: ob.rules,
    summary: [
      { n: 1, title: o.steps[0] ?? "", rows: [[o.factName, ob.identity.name], [o.factSlug, ob.identity.slug], [o.factDirection, ob.identity.direction]] },
      {
        n: 2,
        title: o.steps[1] ?? "",
        rows: ob.admin ? [[o.factAdmin, ob.admin.fullName], [o.factEmail, ob.admin.email], [o.factConfig, ob.config === "BLANK" ? o.configBlank : o.configCopy]] : [],
      },
      {
        n: 3,
        title: o.steps[2] ?? "",
        rows: [
          [o.factPermissions, changes.length ? changes.map((c) => `${roleLabel(c.role)} ${c.granted ? "+" : "−"} ${dict.permissions[c.permission]}`).join(" ; ") : o.noChange],
          [o.factCircuit, ob.workflow.ownerValidation ? o.circuitTwo : o.circuitOne],
        ],
      },
      { n: 4, title: o.steps[3] ?? "", rows: [[o.factRules, t(o.rulesSummary, { deadline: a.deadlineDays[r.deadlineDay].toLowerCase(), time: r.deadlineTime })]] },
    ],
  };
}

const stepHref = (id: string | null, n: number) => (id ? `/plateforme/divisions/nouvelle?division=${id}&etape=${n}` : "/plateforme/divisions/nouvelle");

type OnboardingErrorKey = keyof typeof o.errors;

/** Champs en erreur (422) → messages ; les champs du workflow et des règles viennent de l'écran 12. */
function messagesOf(fields: readonly string[]): FieldErrors {
  const out: FieldErrors = {};
  for (const f of fields) {
    if (f === "slugTaken") out.slug = o.errors.slugTaken;
    else if (f === "emailTaken") out.email = o.errors.emailTaken;
    else if (f in o.errors) out[f] = o.errors[f as OnboardingErrorKey];
    else Object.assign(out, fieldMessages([f]));
  }
  return out;
}

function failureOf(e: unknown): { fields: FieldErrors | null; text: string } {
  if (e instanceof ApiError) {
    if (e.status === 401) return { fields: null, text: o.errors.session };
    if (e.status === 404) return { fields: null, text: o.errors.notFound };
    const body = e.body as { code?: string; fields?: string[]; value?: string } | null;
    if (body?.fields?.length) return { fields: messagesOf(body.fields), text: "" };
    if (body?.code === "incomplete") return { fields: null, text: t(o.errors.incomplete, { n: body.value ?? "1" }) };
  }
  return { fields: null, text: o.errors.unknown };
}

function focusFirst(errors: FieldErrors, ids: Record<string, string>) {
  const first = Object.keys(ids).find((k) => errors[k]);
  if (first) document.getElementById(ids[first] ?? "")?.focus();
}

/** Pied de chaque étape, sous un filet noir : précédente ; enregistrer et quitter, continuer. */
function Footer({ view, pending, onQuit, primary }: { view: View; pending: boolean; onQuit?: () => void; primary: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-20 border-t-2 border-black pt-20">
      {view.step > 1 ? (
        <Link className={buttonClass()} to={stepHref(view.id, view.step - 1)}>
          {o.previous}
        </Link>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-20">
        {onQuit && (
          <Button variant="link" onClick={onQuit} disabled={pending}>
            {o.saveQuit}
          </Button>
        )}
        {primary}
      </div>
    </div>
  );
}

function Failure({ text, onClose }: { text: string | null; onClose: () => void }) {
  return text ? (
    <Alert tone="danger" role="alert" onClose={onClose}>
      <p>{text}</p>
    </Alert>
  ) : null;
}

/** Après une étape : la suivante, ou la liste avec le message « enregistré à l'étape n ». */
function useGo(view: View) {
  const navigate = useNavigate();
  return (how: Intent, saved: { id: string; step: number }, name: string) => {
    if (how === "quit") void navigate("/plateforme", { state: { notice: t(dict.platform.saved, { name, n: saved.step }) } });
    else void navigate(stepHref(saved.id, Math.min(saved.step, view.step + 1)));
  };
}

function StepForm({ title, children, view, pending, onSubmit, primary }: { title: string; children: ReactNode; view: View; pending: boolean; onSubmit: (how: Intent) => void; primary?: string }) {
  return (
    <form
      className="flex flex-col gap-20"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit("next");
      }}
      noValidate
    >
      <h2 className="text-h3">{title}</h2>
      {children}
      <Footer
        view={view}
        pending={pending}
        onQuit={primary ? undefined : () => onSubmit("quit")}
        primary={
          <Button variant="primary" type="submit" disabled={pending}>
            {primary ?? o.next}
          </Button>
        }
      />
    </form>
  );
}

// --- Étape 1 : identité -------------------------------------------------------------

function IdentityStep({ view }: { view: View }) {
  const save = useOnboardingSteps(view.id).identity;
  const go = useGo(view);
  const [v, setV] = useState(view.identity);
  const [slugTouched, setSlugTouched] = useState(Boolean(view.id));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const ids = { name: "division-nom", slug: "division-identifiant", direction: "division-rattachement" };

  function submit(how: Intent) {
    setFailure(null);
    save.mutate(v, {
      onSuccess: (r) => go(how, r, v.name.trim()),
      onError: (e) => {
        const f = failureOf(e);
        if (f.fields) {
          setErrors(f.fields);
          focusFirst(f.fields, ids);
        } else setFailure(f.text);
      },
    });
  }

  return (
    <StepForm title={o.identityTitle} view={view} pending={save.isPending} onSubmit={submit}>
      <RequiredLegend />
      <TextField
        id={ids.name}
        label={o.name}
        required
        autoComplete="off"
        value={v.name}
        error={errors.name}
        onChange={(e) => setV((x) => ({ ...x, name: e.target.value, slug: slugTouched ? x.slug : slugify(e.target.value) }))}
      />
      <TextField
        id={ids.slug}
        label={o.slug}
        required
        autoComplete="off"
        hint={o.slugHint}
        value={v.slug}
        error={errors.slug}
        onChange={(e) => {
          setSlugTouched(true);
          setV((x) => ({ ...x, slug: e.target.value }));
        }}
      />
      <TextField id={ids.direction} label={o.direction} required autoComplete="off" hint={o.directionHint} value={v.direction} error={errors.direction} onChange={(e) => setV((x) => ({ ...x, direction: e.target.value }))} />
      <Failure text={failure} onClose={() => setFailure(null)} />
    </StepForm>
  );
}

// --- Étape 2 : administrateur (planche 13-Onboarding-division) -----------------------

function AdminStep({ view }: { view: View }) {
  const save = useOnboardingSteps(view.id).admin;
  const go = useGo(view);
  const [v, setV] = useState(view.admin);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const ids = { fullName: "admin-nom", email: "admin-email" };

  function submit(how: Intent) {
    setFailure(null);
    save.mutate(v, {
      onSuccess: (r) => go(how, r, view.identity.name),
      onError: (e) => {
        const f = failureOf(e);
        if (f.fields) {
          setErrors(f.fields);
          focusFirst(f.fields, ids);
        } else setFailure(f.text);
      },
    });
  }

  return (
    <StepForm title={o.adminTitle} view={view} pending={save.isPending} onSubmit={submit}>
      <RequiredLegend />
      <TextField id={ids.fullName} label={o.fullName} required autoComplete="off" value={v.fullName} error={errors.fullName} onChange={(e) => setV((x) => ({ ...x, fullName: e.target.value }))} />
      <TextField
        id={ids.email}
        label={o.email}
        type="email"
        required
        autoComplete="off"
        placeholder={o.emailPlaceholder}
        hint={o.emailHint}
        value={v.email}
        error={errors.email}
        onChange={(e) => setV((x) => ({ ...x, email: e.target.value }))}
      />
      <fieldset className="m-0 flex min-w-0 flex-col gap-20 border-0 p-0">
        <legend className="mb-20 p-0 text-h3 font-bold">{o.configTitle}</legend>
        <Radio name="configuration" label={o.copy} hint={o.copyHint} checked={v.config === "COPY"} onChange={() => setV((x) => ({ ...x, config: "COPY" }))} />
        <Radio name="configuration" label={o.blank} hint={o.blankHint} checked={v.config === "BLANK"} onChange={() => setV((x) => ({ ...x, config: "BLANK" }))} />
      </fieldset>
      <Failure text={failure} onClose={() => setFailure(null)} />
    </StepForm>
  );
}

// --- Étape 3 : rôles et workflow ------------------------------------------------------

function RolesStep({ view }: { view: View }) {
  const save = useOnboardingSteps(view.id).roles;
  const go = useGo(view);
  const [matrix, setMatrix] = useState(view.matrix);
  const [w, setW] = useState(view.workflow);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  function submit(how: Intent) {
    setFailure(null);
    save.mutate(
      { matrix, workflow: w },
      {
        onSuccess: (r) => go(how, r, view.identity.name),
        onError: (e) => {
          const f = failureOf(e);
          if (f.fields) {
            setErrors(f.fields);
            document.getElementById("relance")?.focus();
          } else setFailure(f.text);
        },
      },
    );
  }

  return (
    <StepForm title={o.rolesTitle} view={view} pending={save.isPending} onSubmit={submit}>
      <p>{a.permissionsIntro}</p>
      <MatrixTable matrix={matrix} onChange={setMatrix} />
      <WorkflowFields value={w} errors={errors} onChange={(patch) => setW((x) => ({ ...x, ...patch }))} />
      <Failure text={failure} onClose={() => setFailure(null)} />
    </StepForm>
  );
}

// --- Étape 4 : règles de saisie -------------------------------------------------------

function RulesStep({ view }: { view: View }) {
  const save = useOnboardingSteps(view.id).rules;
  const go = useGo(view);
  const [r, setR] = useState(view.rules);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  function submit(how: Intent) {
    setFailure(null);
    save.mutate(r, {
      onSuccess: (res) => go(how, res, view.identity.name),
      onError: (e) => {
        const f = failureOf(e);
        if (f.fields) {
          setErrors(f.fields);
          focusFirstRule(f.fields);
        } else setFailure(f.text);
      },
    });
  }

  return (
    <StepForm title={o.rulesTitle} view={view} pending={save.isPending} onSubmit={submit}>
      <RulesFields value={r} errors={errors} onChange={(patch) => setR((x) => ({ ...x, ...patch }))} />
      <Failure text={failure} onClose={() => setFailure(null)} />
    </StepForm>
  );
}

// --- Étape 5 : récapitulatif ------------------------------------------------------------

function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-trace gap-x-20 gap-y-10">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-595">{k}</dt>
          <dd className="font-bold wrap-anywhere">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryStep({ view }: { view: View }) {
  const finish = useOnboardingSteps(view.id).finish;
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);

  function create() {
    setFailure(null);
    finish.mutate(undefined, {
      onSuccess: (r) => void navigate("/plateforme", { state: { notice: t(dict.platform.created, { name: r.name, email: r.email }) } }),
      onError: (e) => setFailure(failureOf(e).text),
    });
  }

  return (
    <StepForm title={o.summaryTitle} view={view} pending={finish.isPending} onSubmit={create} primary={o.create}>
      <p>{t(o.summaryIntro, { email: view.admin.email })}</p>
      {view.summary.map((s) => (
        <Card key={s.n} muted aria-labelledby={`recap-${s.n}`}>
          <div className="flex flex-wrap items-center justify-between gap-20">
            <h3 className="text-h5" id={`recap-${s.n}`}>
              {t(o.cardTitle, { n: s.n, title: s.title })}
            </h3>
            <Link to={stepHref(view.id, s.n)} aria-label={t(o.editStep, { n: s.n })}>
              {o.edit}
            </Link>
          </div>
          <Facts rows={s.rows} />
        </Card>
      ))}
      <Failure text={failure} onClose={() => setFailure(null)} />
    </StepForm>
  );
}

function Screen({ view }: { view: View }) {
  // Colonne de droite : l'étape précédente en résumé, avec son lien de modification.
  const previous = view.step > 1 && view.step < 5 ? view.summary[view.step - 2] : undefined;
  const editLabel = view.step === 2 ? o.editIdentity : view.step === 3 ? o.editAdmin : t(o.editStep, { n: view.step - 1 });
  const form =
    view.step === 1 ? <IdentityStep view={view} /> : view.step === 2 ? <AdminStep view={view} /> : view.step === 3 ? <RolesStep view={view} /> : view.step === 4 ? <RulesStep view={view} /> : <SummaryStep view={view} />;

  return (
    <main className="flex flex-col gap-30">
      <div className="flex flex-col gap-20">
        <Breadcrumb items={[{ label: dict.platform.title, href: "/plateforme" }, { label: o.title }]} />
        <h1>{o.title}</h1>
      </div>
      <div className="flex flex-col gap-10">
        <SteppedProcess steps={[...o.steps]} current={view.step - 1} label={o.stepsLabel} />
        <p className="text-sm">{t(o.stepOf, { n: view.step })}</p>
      </div>
      <div className="grid gap-30 lg:grid-cols-sign lg:items-start">
        <div className="min-w-0">{form}</div>
        <aside className="flex flex-col gap-20">
          {previous && previous.rows.length > 0 && (
            <Card aria-labelledby="etape-precedente">
              <h2 className="text-h5" id="etape-precedente">
                {t(o.cardTitle, { n: previous.n, title: previous.title })}
              </h2>
              <Facts rows={previous.rows} />
              <p>
                <Link to={stepHref(view.id, previous.n)}>{editLabel}</Link>
              </p>
            </Card>
          )}
          <Alert tone="info">
            <p>{o.isolated}</p>
          </Alert>
        </aside>
      </div>
    </main>
  );
}

export function OnboardingPage() {
  const [params] = useSearchParams();
  const id = params.get("division");
  const query = useOnboarding(id);
  if (!id) return <Screen key="nouvelle" view={NEW} />;
  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <Breadcrumb items={[{ label: dict.platform.title, href: "/plateforme" }, { label: o.title }]} />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="flex flex-col gap-30">
        <Breadcrumb items={[{ label: dict.platform.title, href: "/plateforme" }, { label: o.title }]} />
        <h1>{o.title}</h1>
        <Alert tone="danger" role="alert" heading={o.errors.notFound}>
          <p>
            <Link to="/plateforme">{dict.platform.title}</Link>
          </p>
        </Alert>
      </main>
    );
  }
  const asked = Number(params.get("etape") ?? query.data.step);
  const step = Number.isInteger(asked) ? Math.min(Math.max(asked, 1), query.data.step) : query.data.step;
  // Une étape, un formulaire neuf : changer d'étape repart des données enregistrées.
  return <Screen key={`${id}-${step}`} view={viewOf(query.data, step)} />;
}
