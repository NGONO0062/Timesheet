"use client";
// Administration de division : Rôles et permissions, Workflows, Règles de saisie
// (PROMPT.md §7 et §9.9, planche 12). Chaque bloc s'enregistre seul ; une saisie non
// enregistrée reste à l'écran en cas d'échec.
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { savePermissions, saveRulesForm, saveWorkflowForm, type AdminError } from "@/app/actions/admin";
import { Alert, Badge, ListGroup, ListGroupItem } from "@/components/ods/Display";
import { Checkbox, FieldError, InputGroup, InputGroupText, Radio, RadioGroup, SelectField, Switch, TextField } from "@/components/ods/Form";
import { checkRules, checkWorkflow, DEADLINE_DAYS, REMINDER_DAYS, STEPS, WEEKDAY_KEYS, type Matrix, type RulesErrors, type RulesInput, type WorkflowErrors, type WorkflowInput } from "@/lib/admin/rules";
import { formatNumber } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { DIVISION_ROLES, isLocked, PERMISSIONS, type DivisionRole, type Permission } from "@/lib/permissions";

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

// ---------------------------------------------------------------------------
// Rôles et permissions
// ---------------------------------------------------------------------------

export function PermissionsSection({ initial, roles }: { initial: Matrix; roles: Array<{ value: DivisionRole; label: string }> }) {
  const [matrix, setMatrix] = useState(initial);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();

  function toggle(role: DivisionRole, permission: Permission, on: boolean) {
    setNotice(null);
    setMatrix((m) => ({ ...m, [role]: on ? PERMISSIONS.filter((p) => p === permission || m[role].includes(p)) : m[role].filter((p) => p !== permission) }));
  }

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
      <div className="table-responsive">
        <table className="table ts-matrix">
          <caption className="visually-hidden">{a.permissionsCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{a.colPermission}</th>
              {DIVISION_ROLES.map((r) => (
                <th key={r} scope="col">{roles.find((x) => x.value === r)?.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p}>
                <th scope="row">{dict.permissions[p]}</th>
                {DIVISION_ROLES.map((r) => {
                  const locked = isLocked(r, p);
                  const label = t(a.permissionOf, { permission: dict.permissions[p], role: roles.find((x) => x.value === r)?.label ?? r });
                  return (
                    <td key={r}>
                      <Checkbox
                        label={<span className="visually-hidden">{label}</span>}
                        checked={locked || matrix[r].includes(p)}
                        disabled={locked}
                        aria-describedby={locked ? "permission-verrouillee" : undefined}
                        onChange={(e) => toggle(r, p, e.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small text-secondary" id="permission-verrouillee">{a.lockedNote}</p>
      <div className="ts-actions">
        <button className="btn" type="button" onClick={save} disabled={pending}>
          {a.savePermissions}
        </button>
      </div>
      <Result notice={notice} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

function Step({ n, children, end }: { n: number; children: ReactNode; end: ReactNode }) {
  return (
    <ListGroupItem>
      <span>
        {n}. {children}
      </span>
      {end}
    </ListGroupItem>
  );
}

export function WorkflowSection({ initial }: { initial: WorkflowInput }) {
  const [w, setW] = useState(initial);
  const [errors, setErrors] = useState<WorkflowErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<WorkflowInput>) => {
    setNotice(null);
    setW((x) => ({ ...x, ...patch }));
  };
  const c = a.circuit;

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
        <h3 className="h5" id="titre-circuit">{a.circuitTitle}</h3>
        <ListGroup className="ts-circuit" label={a.circuitTitle}>
          <Step n={1} end={<Badge dark>{a.mandatory}</Badge>}>
            <strong>{c[0].strong}</strong> {c[0].text}
          </Step>
          <Step n={2} end={<Badge dark>{a.mandatory}</Badge>}>
            <strong>{c[1].strong}</strong> {c[1].text}
          </Step>
          <Step n={3} end={<Switch label={a.ownerStepLabel} checked={w.ownerValidation} states={[a.stepOn, a.stepOff]} onChange={(e) => set({ ownerValidation: e.target.checked })} />}>
            <strong>{c[2].strong}</strong> {c[2].text}
          </Step>
          <Step n={4} end={<Switch label={a.hrSendLabel} checked={w.hrAutoSend} states={[a.sendAuto, a.sendManual]} onChange={(e) => set({ hrAutoSend: e.target.checked })} />}>
            <strong>{c[3].strong}</strong> {c[3].text}
          </Step>
        </ListGroup>
        <div className="ts-form-grid">
          <TextField id="email-rh" label={a.hrEmail} type="email" required autoComplete="off" value={w.hrEmail} error={errors.hrEmail} onChange={(e) => set({ hrEmail: e.target.value })} />
          <SelectField label={a.reminder} value={String(w.reminderAfterWorkingDays)} error={errors.reminder} onChange={(e) => set({ reminderAfterWorkingDays: Number(e.target.value) })}>
            {REMINDER_DAYS.map((n) => (
              <option key={n} value={n}>{t(a.reminderOption, { n })}</option>
            ))}
          </SelectField>
          <div style={{ alignSelf: "center" }}>
            <Switch label={a.delegate} text={a.delegate} checked={w.delegateToOwner} onChange={(e) => set({ delegateToOwner: e.target.checked })} />
          </div>
        </div>
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

// ---------------------------------------------------------------------------
// Règles de saisie
// ---------------------------------------------------------------------------

const FIELD_IDS: Record<keyof RulesErrors, string> = {
  workingDays: "jour-MONDAY",
  hoursPerDay: "heures-par-jour",
  step: "pas-de-saisie",
  deadline: "echeance-jour",
  threshold: "seuil-alerte",
};

export function RulesSection({ initial }: { initial: RulesInput }) {
  const [saved, setSaved] = useState(initial);
  const [r, setR] = useState(initial);
  const [errors, setErrors] = useState<RulesErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(r) !== JSON.stringify(saved);
  const set = (patch: Partial<RulesInput>) => {
    setNotice(null);
    setR((x) => ({ ...x, ...patch }));
  };

  function focusFirst(e: RulesErrors) {
    const first = (Object.keys(FIELD_IDS) as Array<keyof RulesErrors>).find((k) => e[k]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setNotice(null);
    const local = checkRules(r);
    setErrors(local);
    if (Object.keys(local).length) return focusFirst(local);
    start(async () => {
      const res = await saveRulesForm(r);
      if (res.ok) {
        setSaved(r);
        setNotice({ tone: "success", text: a.rulesSaved });
      } else if ("fields" in res) {
        setErrors(res.fields);
        focusFirst(res.fields);
      } else setNotice({ tone: "danger", text: failureText(res.error) });
    });
  }

  return (
    <section id="regles" aria-labelledby="titre-regles" className="ts-section">
      <h2 id="titre-regles">{a.rulesTitle}</h2>
      <form className="ts-section" onSubmit={onSubmit} noValidate>
        <div className="ts-form-grid">
          <RadioGroup legend={a.unit}>
            <Radio name="unite" label={a.unitHours} checked={r.unit === "HOURS"} onChange={() => set({ unit: "HOURS" })} />
            <Radio name="unite" label={a.unitDays} checked={r.unit === "DAYS"} onChange={() => set({ unit: "DAYS" })} />
          </RadioGroup>
          <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }} aria-describedby={errors.workingDays ? "jours-erreur" : undefined}>
            <legend className="form-label" style={{ float: "none", padding: 0 }}>{a.workingDays}</legend>
            <div className="ts-weekdays">
              {WEEKDAY_KEYS.map((d, i) => (
                <Checkbox
                  key={d}
                  id={`jour-${d}`}
                  label={<abbr title={dict.weekdays[i]} style={{ textDecoration: "none" }}>{dict.weekdaysShort[i]}</abbr>}
                  aria-label={dict.weekdays[i]}
                  checked={r.workingDays.includes(d)}
                  onChange={(e) => set({ workingDays: WEEKDAY_KEYS.filter((k) => (k === d ? e.target.checked : r.workingDays.includes(k))) })}
                />
              ))}
            </div>
            {errors.workingDays && (
              <FieldError id="jours-erreur">{errors.workingDays}</FieldError>
            )}
          </fieldset>
          <div>
            <label className="form-label is-required" htmlFor="heures-par-jour">{a.hoursPerDay}</label>
            <InputGroup>
              <input
                id="heures-par-jour"
                className={errors.hoursPerDay ? "form-control is-invalid" : "form-control"}
                inputMode="decimal"
                aria-required
                aria-invalid={errors.hoursPerDay ? true : undefined}
                aria-describedby={errors.hoursPerDay ? "heures-par-jour-erreur" : undefined}
                value={r.hoursPerDay}
                onChange={(e) => set({ hoursPerDay: e.target.value })}
              />
              <InputGroupText>{a.hoursSuffix}</InputGroupText>
            </InputGroup>
            {errors.hoursPerDay && <FieldError id="heures-par-jour-erreur">{errors.hoursPerDay}</FieldError>}
          </div>
          <SelectField id="pas-de-saisie" label={a.step} value={String(r.step)} error={errors.step} onChange={(e) => set({ step: Number(e.target.value) })}>
            {STEPS.map((s) => (
              <option key={s} value={s}>{t(a.stepOption, { n: formatNumber(s) })}</option>
            ))}
          </SelectField>
          <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
            <legend className="form-label is-required" style={{ float: "none", padding: 0 }}>{a.deadline}</legend>
            <div style={{ display: "flex", gap: 10 }}>
              <select
                id="echeance-jour"
                className={errors.deadline ? "form-select is-invalid" : "form-select"}
                aria-label={a.deadline}
                aria-describedby={errors.deadline ? "echeance-erreur" : undefined}
                value={r.deadlineDay}
                onChange={(e) => set({ deadlineDay: e.target.value })}
              >
                {DEADLINE_DAYS.map((d) => (
                  <option key={d} value={d}>{a.deadlineDays[d]}</option>
                ))}
              </select>
              <input
                className={errors.deadline ? "form-control is-invalid" : "form-control"}
                aria-label={a.deadlineTime}
                aria-describedby={errors.deadline ? "echeance-erreur" : undefined}
                inputMode="numeric"
                value={r.deadlineTime}
                onChange={(e) => set({ deadlineTime: e.target.value })}
                style={{ maxWidth: 100 }}
              />
            </div>
            {errors.deadline && <FieldError id="echeance-erreur">{errors.deadline}</FieldError>}
          </fieldset>
          <div>
            <label className="form-label" htmlFor="seuil-alerte">{a.threshold}</label>
            <InputGroup>
              <input
                id="seuil-alerte"
                className={errors.threshold ? "form-control is-invalid" : "form-control"}
                inputMode="numeric"
                aria-invalid={errors.threshold ? true : undefined}
                aria-describedby={errors.threshold ? "seuil-erreur" : undefined}
                value={r.fillAlertThreshold}
                onChange={(e) => set({ fillAlertThreshold: e.target.value })}
              />
              <InputGroupText>{a.thresholdSuffix}</InputGroupText>
            </InputGroup>
            {errors.threshold && <FieldError id="seuil-erreur">{errors.threshold}</FieldError>}
          </div>
          <Switch label={a.futureWeeks} text={a.futureWeeks} checked={r.allowFutureWeeks} onChange={(e) => set({ allowFutureWeeks: e.target.checked })} />
          <Switch label={a.lockAfterValidation} text={a.lockAfterValidation} checked={r.lockAfterValidation} onChange={(e) => set({ lockAfterValidation: e.target.checked })} />
        </div>
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
