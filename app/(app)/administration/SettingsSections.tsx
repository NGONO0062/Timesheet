"use client";
// Administration de division : Rôles et permissions, Workflows, Règles de saisie
// (PROMPT.md §7 et §9.9, planche 12). Chaque bloc s'enregistre seul ; une saisie non
// enregistrée reste à l'écran en cas d'échec. Champs partagés avec l'onboarding.
import { useState, useTransition, type FormEvent } from "react";
import { savePermissions, saveRulesForm, saveWorkflowForm, type AdminError } from "@/app/actions/admin";
import { Alert } from "@/components/ods/Display";
import { focusFirstRule, MatrixTable, RulesFields, WorkflowFields } from "@/components/ts/DivisionSettingsFields";
import { checkRules, checkWorkflow, type Matrix, type RulesErrors, type RulesInput, type WorkflowErrors, type WorkflowInput } from "@/lib/admin/rules";
import { dict } from "@/lib/i18n";

const a = dict.admin;

type Notice = { tone: "success" | "danger"; text: string } | null;

function Result({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <Alert tone={notice.tone} role={notice.tone === "danger" ? "alert" : "status"}>
      <p>{notice.text}</p>
    </Alert>
  );
}

const failureText = (code: AdminError) => a.errors[code];

export function PermissionsSection({ initial }: { initial: Matrix }) {
  const [matrix, setMatrix] = useState(initial);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();

  function save() {
    setNotice(null);
    start(async () => {
      const r = await savePermissions(matrix);
      setNotice(r.ok ? { tone: "success", text: a.permissionsSaved } : { tone: "danger", text: failureText(r.error) });
    });
  }

  return (
    <section id="permissions" aria-labelledby="titre-permissions" className="ts-section">
      <h2 id="titre-permissions">{a.permissionsTitle}</h2>
      <p>{a.permissionsIntro}</p>
      <MatrixTable matrix={matrix} onChange={(m) => { setNotice(null); setMatrix(m); }} />
      <div className="ts-actions">
        <button className="btn" type="button" onClick={save} disabled={pending}>
          {a.savePermissions}
        </button>
      </div>
      <Result notice={notice} />
    </section>
  );
}

export function WorkflowSection({ initial }: { initial: WorkflowInput }) {
  const [w, setW] = useState(initial);
  const [errors, setErrors] = useState<WorkflowErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const local = checkWorkflow(w);
    setErrors(local);
    if (local.hrEmail) return document.getElementById("email-rh")?.focus();
    start(async () => {
      const r = await saveWorkflowForm(w);
      if (r.ok) setNotice({ tone: "success", text: a.workflowSaved });
      else if ("fields" in r) {
        setErrors(r.fields);
        document.getElementById("email-rh")?.focus();
      } else setNotice({ tone: "danger", text: failureText(r.error) });
    });
  }

  return (
    <section id="workflows" aria-labelledby="titre-workflows" className="ts-section">
      <h2 id="titre-workflows">{a.workflowTitle}</h2>
      <form className="ts-section" onSubmit={onSubmit} noValidate>
        <WorkflowFields value={w} errors={errors} onChange={(patch) => { setNotice(null); setW((x) => ({ ...x, ...patch })); }} />
        <div className="ts-actions">
          <button className="btn" type="submit" disabled={pending}>
            {a.saveWorkflow}
          </button>
        </div>
        <Result notice={notice} />
      </form>
    </section>
  );
}

export function RulesSection({ initial }: { initial: RulesInput }) {
  const [saved, setSaved] = useState(initial);
  const [r, setR] = useState(initial);
  const [errors, setErrors] = useState<RulesErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(r) !== JSON.stringify(saved);

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setNotice(null);
    const local = checkRules(r);
    setErrors(local);
    if (Object.keys(local).length) return focusFirstRule(local);
    start(async () => {
      const res = await saveRulesForm(r);
      if (res.ok) {
        setSaved(r);
        setNotice({ tone: "success", text: a.rulesSaved });
      } else if ("fields" in res) {
        setErrors(res.fields);
        focusFirstRule(res.fields);
      } else setNotice({ tone: "danger", text: failureText(res.error) });
    });
  }

  return (
    <section id="regles" aria-labelledby="titre-regles" className="ts-section">
      <h2 id="titre-regles">{a.rulesTitle}</h2>
      <form className="ts-section" onSubmit={onSubmit} noValidate>
        <RulesFields value={r} errors={errors} onChange={(patch) => { setNotice(null); setR((x) => ({ ...x, ...patch })); }} />
        <div className="ts-actions">
          <button className="btn" type="button" disabled={!dirty || pending} onClick={() => { setR(saved); setErrors({}); setNotice(null); }}>
            {a.cancel}
          </button>
          <button className="btn" type="submit" disabled={pending}>
            {a.saveRules}
          </button>
        </div>
        <Result notice={notice} />
      </form>
    </section>
  );
}
