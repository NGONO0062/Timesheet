// Champs de configuration d'une division : matrice des permissions, workflow, règles de
// saisie (PROMPT.md §7 et §9.9, planche 12). Contrôlés, sans bouton : l'administration de
// division (écran 12) et l'onboarding (écran 13, jalon 7) les enregistrent chacun à leur façon.
import type { ReactNode } from "react";
import {
  DEADLINE_DAYS,
  DIVISION_ROLES,
  isLocked,
  PERMISSIONS,
  REMINDER_DAYS,
  toggleMatrix,
  WEEKDAYS,
  type Matrix,
  type Rules,
  type Workflow,
} from "@/entities/admin";
import { roleLabel } from "@/entities/viewer";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { Badge, ListGroup, ListGroupItem, Table } from "@/shared/ui/Display";
import { Checkbox, CONTROL, FieldError, InputGroup, InputGroupText, SelectField, Switch, TextField } from "@/shared/ui/Form";

const a = dict.admin;

export type FieldErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// Rôles et permissions
// ---------------------------------------------------------------------------

export function MatrixTable({ matrix, onChange }: { matrix: Matrix; onChange: (next: Matrix) => void }) {
  return (
    <div className="flex flex-col gap-10">
      <Table caption={a.permissionsCaption}>
        <thead>
          <tr>
            <th scope="col">{a.colPermission}</th>
            {DIVISION_ROLES.map((r) => (
              <th key={r} scope="col" className="text-center">
                {roleLabel(r)}
              </th>
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
                      className="justify-center"
                      label={<span className="sr-only">{t(a.permissionOf, { permission: dict.permissions[p], role: roleLabel(r) })}</span>}
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
      </Table>
      <p className="text-sm text-gray-595" id="permission-verrouillee">
        {a.lockedNote}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

function Step({ n, children, end, note }: { n: number; children: ReactNode; end: ReactNode; note?: { id: string; text: string } }) {
  return (
    <ListGroupItem className="min-h-60">
      <span className="flex flex-col gap-5">
        <span>
          {n}. {children}
        </span>
        {note && (
          <span className="text-sm text-gray-595" id={note.id}>
            {note.text}
          </span>
        )}
      </span>
      {end}
    </ListGroupItem>
  );
}

export function WorkflowFields({ value: w, errors, onChange }: { value: Workflow; errors: FieldErrors; onChange: (patch: Partial<Workflow>) => void }) {
  const c = a.circuit;
  return (
    <div className="flex flex-col gap-20">
      <h3 className="text-h5" id="titre-circuit">
        {a.circuitTitle}
      </h3>
      <ListGroup label={a.circuitTitle}>
        <Step n={1} end={<Badge dark>{a.mandatory}</Badge>}>
          <strong>{c[0]?.strong}</strong> {c[0]?.text}
        </Step>
        <Step n={2} end={<Badge dark>{a.mandatory}</Badge>}>
          <strong>{c[1]?.strong}</strong> {c[1]?.text}
        </Step>
        {/* Pas encore branché (docs/questions-ouvertes.md, point 52) : désactivé, raison écrite dessous. */}
        <Step
          n={3}
          note={{ id: "etape-n2-indisponible", text: a.ownerStepUnavailable }}
          end={<Switch label={a.ownerStepLabel} checked={false} disabled aria-describedby="etape-n2-indisponible" states={[a.stepOn, a.stepOff]} onChange={() => undefined} />}
        >
          <strong>{c[2]?.strong}</strong> {c[2]?.text}
        </Step>
        <Step n={4} end={<Switch label={a.hrSendLabel} checked={w.hrAutoSend} states={[a.sendAuto, a.sendManual]} onChange={(e) => onChange({ hrAutoSend: e.target.checked })} />}>
          <strong>{c[3]?.strong}</strong> {c[3]?.text}
        </Step>
      </ListGroup>
      <div className="grid gap-20 md:grid-cols-3 md:items-end">
        <TextField id="email-rh" label={a.hrEmail} type="email" required autoComplete="off" value={w.hrEmail} error={errors.hrEmail} onChange={(e) => onChange({ hrEmail: e.target.value })} />
        <SelectField id="relance" label={a.reminder} value={String(w.reminderAfterWorkingDays)} error={errors.reminder} onChange={(e) => onChange({ reminderAfterWorkingDays: Number(e.target.value) })}>
          {REMINDER_DAYS.map((n) => (
            <option key={n} value={n}>
              {t(a.reminderOption, { n })}
            </option>
          ))}
        </SelectField>
        <Switch className="min-h-control" label={a.delegate} text={a.delegate} checked={w.delegateToOwner} onChange={(e) => onChange({ delegateToOwner: e.target.checked })} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Règles de saisie
// ---------------------------------------------------------------------------

const RULE_FIELD_IDS: Record<string, string> = { workingDays: "jour-MONDAY", deadline: "echeance-jour", threshold: "seuil-alerte" };

/** Focus sur le premier champ en erreur (§5.5). */
export function focusFirstRule(errors: FieldErrors) {
  const first = Object.keys(RULE_FIELD_IDS).find((k) => errors[k]);
  if (first) document.getElementById(RULE_FIELD_IDS[first] ?? "")?.focus();
}

export function RulesFields({ value: r, errors, onChange }: { value: Rules; errors: FieldErrors; onChange: (patch: Partial<Rules>) => void }) {
  return (
    <div className="grid gap-20 md:grid-cols-3">
      <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby={errors.workingDays ? "jours-erreur" : undefined}>
        <legend className="mb-5 p-0 font-bold">{a.workingDays}</legend>
        <div className="grid grid-cols-4 gap-x-20 gap-y-10">
          {WEEKDAYS.map((d, i) => (
            <Checkbox
              key={d}
              id={`jour-${d}`}
              label={
                <abbr title={dict.weekdays[i]} className="no-underline">
                  {dict.weekdaysShort[i]}
                </abbr>
              }
              aria-label={dict.weekdays[i]}
              checked={r.workingDays.includes(d)}
              onChange={(e) => onChange({ workingDays: WEEKDAYS.filter((k) => (k === d ? e.target.checked : r.workingDays.includes(k))) })}
            />
          ))}
        </div>
        {errors.workingDays && <FieldError id="jours-erreur">{errors.workingDays}</FieldError>}
      </fieldset>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="required-mark mb-5 p-0 font-bold">{a.deadline}</legend>
        <div className="flex gap-10">
          <select
            id="echeance-jour"
            className={cx(CONTROL, "h-control flex-1 rounded-md")}
            aria-label={a.deadline}
            aria-invalid={errors.deadline ? true : undefined}
            aria-describedby={errors.deadline ? "echeance-erreur" : undefined}
            value={r.deadlineDay}
            onChange={(e) => onChange({ deadlineDay: e.target.value === "MONDAY" ? "MONDAY" : "FRIDAY" })}
          >
            {DEADLINE_DAYS.map((d) => (
              <option key={d} value={d}>
                {a.deadlineDays[d]}
              </option>
            ))}
          </select>
          <input
            className={cx(CONTROL, "h-control w-time rounded-md")}
            aria-label={a.deadlineTime}
            aria-invalid={errors.deadline ? true : undefined}
            aria-describedby={errors.deadline ? "echeance-erreur" : undefined}
            inputMode="numeric"
            value={r.deadlineTime}
            onChange={(e) => onChange({ deadlineTime: e.target.value })}
          />
        </div>
        {errors.deadline && <FieldError id="echeance-erreur">{errors.deadline}</FieldError>}
      </fieldset>
      <div>
        <label className="mb-5 block font-bold" htmlFor="seuil-alerte">
          {a.threshold}
        </label>
        <InputGroup className="w-hours">
          <input
            id="seuil-alerte"
            className={cx(CONTROL, "h-control rounded-l-md")}
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
