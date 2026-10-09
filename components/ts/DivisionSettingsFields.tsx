"use client";
// Champs de configuration d'une division : matrice des permissions, workflow, règles de
// saisie (PROMPT.md §7 et §9.9, planche 12). Contrôlés, sans bouton : l'administration de
// division (écran 12) et l'onboarding (écran 13, étapes 3 et 4) les enregistrent chacun
// à leur manière.
import type { ReactNode } from "react";
import { Badge, ListGroup, ListGroupItem } from "@/components/ods/Display";
import { Checkbox, FieldError, InputGroup, InputGroupText, Radio, RadioGroup, SelectField, Switch, TextField } from "@/components/ods/Form";
import { DEADLINE_DAYS, REMINDER_DAYS, STEPS, WEEKDAY_KEYS, type Matrix, type RulesErrors, type RulesInput, type WorkflowErrors, type WorkflowInput } from "@/lib/admin/rules";
import { formatNumber } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { DIVISION_ROLES, isLocked, PERMISSIONS, type DivisionRole, type Permission } from "@/lib/permissions";
import { roleLabel } from "@/lib/viewer";
import { TableScroll } from "@/components/ods/TableScroll";

const a = dict.admin;

const fieldset = { margin: 0, padding: 0, border: 0, minWidth: 0 } as const;
const legend = { float: "none", padding: 0 } as const;

// ---------------------------------------------------------------------------
// Rôles et permissions
// ---------------------------------------------------------------------------

export function toggleMatrix(m: Matrix, role: DivisionRole, permission: Permission, on: boolean): Matrix {
  return { ...m, [role]: on ? PERMISSIONS.filter((p) => p === permission || m[role].includes(p)) : m[role].filter((p) => p !== permission) };
}

export function MatrixTable({ matrix, onChange }: { matrix: Matrix; onChange: (next: Matrix) => void }) {
  return (
    <>
      <TableScroll>
        <table className="table ts-matrix">
          <caption className="visually-hidden">{a.permissionsCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{a.colPermission}</th>
              {DIVISION_ROLES.map((r) => (
                <th key={r} scope="col">{roleLabel(r)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p}>
                <th scope="row">{dict.permissions[p]}</th>
                {DIVISION_ROLES.map((r) => {
                  const locked = isLocked(r, p);
                  return (
                    <td key={r}>
                      <Checkbox
                        label={<span className="visually-hidden">{t(a.permissionOf, { permission: dict.permissions[p], role: roleLabel(r) })}</span>}
                        checked={locked || matrix[r].includes(p)}
                        disabled={locked}
                        aria-describedby={locked ? "permission-verrouillee" : undefined}
                        onChange={(e) => onChange(toggleMatrix(matrix, r, p, e.target.checked))}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <p className="small text-secondary" id="permission-verrouillee">{a.lockedNote}</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Workflow
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

export function WorkflowFields({ value: w, errors, onChange }: { value: WorkflowInput; errors: WorkflowErrors; onChange: (patch: Partial<WorkflowInput>) => void }) {
  const c = a.circuit;
  return (
    <>
      <h3 className="h5" id="titre-circuit">{a.circuitTitle}</h3>
      <ListGroup className="ts-circuit" label={a.circuitTitle}>
        <Step n={1} end={<Badge dark>{a.mandatory}</Badge>}>
          <strong>{c[0].strong}</strong> {c[0].text}
        </Step>
        <Step n={2} end={<Badge dark>{a.mandatory}</Badge>}>
          <strong>{c[1].strong}</strong> {c[1].text}
        </Step>
        <Step n={3} end={<Switch label={a.ownerStepLabel} checked={w.ownerValidation} states={[a.stepOn, a.stepOff]} onChange={(e) => onChange({ ownerValidation: e.target.checked })} />}>
          <strong>{c[2].strong}</strong> {c[2].text}
        </Step>
        <Step n={4} end={<Switch label={a.hrSendLabel} checked={w.hrAutoSend} states={[a.sendAuto, a.sendManual]} onChange={(e) => onChange({ hrAutoSend: e.target.checked })} />}>
          <strong>{c[3].strong}</strong> {c[3].text}
        </Step>
      </ListGroup>
      <div className="ts-form-grid">
        <TextField id="email-rh" label={a.hrEmail} type="email" required autoComplete="off" value={w.hrEmail} error={errors.hrEmail} onChange={(e) => onChange({ hrEmail: e.target.value })} />
        <SelectField label={a.reminder} value={String(w.reminderAfterWorkingDays)} error={errors.reminder} onChange={(e) => onChange({ reminderAfterWorkingDays: Number(e.target.value) })}>
          {REMINDER_DAYS.map((n) => (
            <option key={n} value={n}>{t(a.reminderOption, { n })}</option>
          ))}
        </SelectField>
        <div style={{ alignSelf: "center" }}>
          <Switch label={a.delegate} text={a.delegate} checked={w.delegateToOwner} onChange={(e) => onChange({ delegateToOwner: e.target.checked })} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Règles de saisie
// ---------------------------------------------------------------------------

const RULE_FIELD_IDS: Record<keyof RulesErrors, string> = {
  workingDays: "jour-MONDAY",
  hoursPerDay: "heures-par-jour",
  step: "pas-de-saisie",
  deadline: "echeance-jour",
  threshold: "seuil-alerte",
};

/** Focus sur le premier champ en erreur (§5.5). */
export function focusFirstRule(e: RulesErrors) {
  const first = (Object.keys(RULE_FIELD_IDS) as Array<keyof RulesErrors>).find((k) => e[k]);
  if (first) document.getElementById(RULE_FIELD_IDS[first])?.focus();
}

export function RulesFields({ value: r, errors, onChange }: { value: RulesInput; errors: RulesErrors; onChange: (patch: Partial<RulesInput>) => void }) {
  return (
    <div className="ts-form-grid">
      <RadioGroup legend={a.unit}>
        <Radio name="unite" label={a.unitHours} checked={r.unit === "HOURS"} onChange={() => onChange({ unit: "HOURS" })} />
        <Radio name="unite" label={a.unitDays} checked={r.unit === "DAYS"} onChange={() => onChange({ unit: "DAYS" })} />
      </RadioGroup>
      <fieldset style={fieldset} aria-describedby={errors.workingDays ? "jours-erreur" : undefined}>
        <legend className="form-label" style={legend}>{a.workingDays}</legend>
        <div className="ts-weekdays">
          {WEEKDAY_KEYS.map((d, i) => (
            <Checkbox
              key={d}
              id={`jour-${d}`}
              label={<abbr title={dict.weekdays[i]} style={{ textDecoration: "none" }}>{dict.weekdaysShort[i]}</abbr>}
              aria-label={dict.weekdays[i]}
              checked={r.workingDays.includes(d)}
              onChange={(e) => onChange({ workingDays: WEEKDAY_KEYS.filter((k) => (k === d ? e.target.checked : r.workingDays.includes(k))) })}
            />
          ))}
        </div>
        {errors.workingDays && <FieldError id="jours-erreur">{errors.workingDays}</FieldError>}
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
            onChange={(e) => onChange({ hoursPerDay: e.target.value })}
          />
          <InputGroupText>{a.hoursSuffix}</InputGroupText>
        </InputGroup>
        {errors.hoursPerDay && <FieldError id="heures-par-jour-erreur">{errors.hoursPerDay}</FieldError>}
      </div>
      <SelectField id="pas-de-saisie" label={a.step} value={String(r.step)} error={errors.step} onChange={(e) => onChange({ step: Number(e.target.value) })}>
        {STEPS.map((s) => (
          <option key={s} value={s}>{t(a.stepOption, { n: formatNumber(s) })}</option>
        ))}
      </SelectField>
      <fieldset style={fieldset}>
        <legend className="form-label is-required" style={legend}>{a.deadline}</legend>
        <div style={{ display: "flex", gap: 10 }}>
          <select
            id="echeance-jour"
            className={errors.deadline ? "form-select is-invalid" : "form-select"}
            aria-label={a.deadline}
            aria-describedby={errors.deadline ? "echeance-erreur" : undefined}
            value={r.deadlineDay}
            onChange={(e) => onChange({ deadlineDay: e.target.value })}
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
            onChange={(e) => onChange({ deadlineTime: e.target.value })}
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
            onChange={(e) => onChange({ fillAlertThreshold: e.target.value })}
          />
          <InputGroupText>{a.thresholdSuffix}</InputGroupText>
        </InputGroup>
        {errors.threshold && <FieldError id="seuil-erreur">{errors.threshold}</FieldError>}
      </div>
      <Switch label={a.futureWeeks} text={a.futureWeeks} checked={r.allowFutureWeeks} onChange={(e) => onChange({ allowFutureWeeks: e.target.checked })} />
      <Switch label={a.lockAfterValidation} text={a.lockAfterValidation} checked={r.lockAfterValidation} onChange={(e) => onChange({ lockAfterValidation: e.target.checked })} />
    </div>
  );
}
