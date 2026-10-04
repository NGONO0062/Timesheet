"use client";
// Champs de formulaire ODS : Input, Select, Textarea, Checkbox, Radio, Switch,
// Input group, Quantity selector. Label relié, aria-required, erreurs reliées
// par aria-describedby (PROMPT.md §14).
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { dict } from "@/lib/i18n";
import { Mark, Icon } from "./Icon";

type FieldSize = "sm" | "md" | "lg";

type FieldFrame = {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /** Label présent pour les lecteurs d'écran mais masqué. */
  hideLabel?: boolean;
};

function useFieldIds(id?: string) {
  const auto = useId();
  const base = id ?? auto;
  return { id: base, hintId: `${base}-aide`, errorId: `${base}-erreur` };
}

function describedBy(hint: ReactNode, error: ReactNode, ids: { hintId: string; errorId: string }, extra?: string) {
  return cx(hint ? ids.hintId : null, error ? ids.errorId : null, extra) || undefined;
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="invalid-feedback" id={id}>
      <Mark tone="danger" />
      {children}
    </p>
  );
}

function Frame({ frame, ids, children }: { frame: FieldFrame; ids: ReturnType<typeof useFieldIds>; children: ReactNode }) {
  return (
    <div>
      <label className={cx("form-label", frame.required && "is-required", frame.hideLabel && "visually-hidden")} htmlFor={ids.id}>
        {frame.label}
      </label>
      {children}
      {frame.hint && (
        <p className="form-text" id={ids.hintId}>
          {frame.hint}
        </p>
      )}
      {frame.error && <FieldError id={ids.errorId}>{frame.error}</FieldError>}
    </div>
  );
}

const sizeClass = (size: FieldSize | undefined) => (size === "sm" ? "form-control-sm" : size === "lg" ? "form-control-lg" : null);

type InputProps = FieldFrame & Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: FieldSize };

/** Input ODS avec son label, son aide et son erreur. */
export function TextField({ label, required, hint, error, hideLabel, size, className, id, ...rest }: InputProps) {
  const ids = useFieldIds(id);
  return (
    <Frame frame={{ label, required, hint, error, hideLabel }} ids={ids}>
      <input
        id={ids.id}
        className={cx("form-control", sizeClass(size), error ? "is-invalid" : null, className)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids, rest["aria-describedby"])}
        {...rest}
      />
    </Frame>
  );
}

/** Date en saisie texte jj/mm/aaaa : ODS Web n'a pas de sélecteur de date. */
export function DateField(props: Omit<InputProps, "type" | "inputMode" | "placeholder">) {
  return <TextField {...props} type="text" inputMode="numeric" placeholder="jj/mm/aaaa" hint={props.hint ?? dict.form.dateFormat} />;
}

type TextareaProps = FieldFrame & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextareaField({ label, required, hint, error, hideLabel, className, id, ...rest }: TextareaProps) {
  const ids = useFieldIds(id);
  return (
    <Frame frame={{ label, required, hint, error, hideLabel }} ids={ids}>
      <textarea
        id={ids.id}
        className={cx("form-control", error ? "is-invalid" : null, className)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        {...rest}
      />
    </Frame>
  );
}

type SelectProps = FieldFrame & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: FieldSize };

export function SelectField({ label, required, hint, error, hideLabel, size, className, id, children, ...rest }: SelectProps) {
  const ids = useFieldIds(id);
  return (
    <Frame frame={{ label, required, hint, error, hideLabel }} ids={ids}>
      <select
        id={ids.id}
        className={cx("form-select", sizeClass(size), error ? "is-invalid" : null, className)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        {...rest}
      >
        {children}
      </select>
    </Frame>
  );
}

type CheckProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; hint?: ReactNode };

/** Case à cocher ODS : carrée, coche noire sur orange de marque. */
export function Checkbox({ label, hint, id, className, ...rest }: CheckProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={cx("form-check", className)}>
      <input className="form-check-input" type="checkbox" id={inputId} aria-describedby={hint ? `${inputId}-aide` : undefined} {...rest} />
      <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label className="form-check-label" htmlFor={inputId}>
          {label}
        </label>
        {hint && (
          <span className="form-text" id={`${inputId}-aide`} style={{ marginTop: 0 }}>
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

/** Radio ODS : rond. */
export function Radio({ label, hint, id, className, ...rest }: CheckProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={cx("form-check", className)}>
      <input className="form-check-input" type="radio" id={inputId} aria-describedby={hint ? `${inputId}-aide` : undefined} {...rest} />
      <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label className="form-check-label" htmlFor={inputId}>
          {label}
        </label>
        {hint && (
          <span className="form-text" id={`${inputId}-aide`} style={{ marginTop: 0 }}>
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

/** Groupe de radios avec légende. */
export function RadioGroup({ legend, required, children }: { legend: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <fieldset style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0, border: 0, minWidth: 0 }}>
      <legend className={cx("form-label", required && "is-required")} style={{ float: "none", padding: 0 }}>
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  /** Nom accessible de l'interrupteur (le texte visible est son état). */
  label: string;
  checked: boolean;
};

/** Switch ODS. Son état est écrit à côté : Actif / Désactivé. */
export function Switch({ label, checked, id, className, ...rest }: SwitchProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <span className={cx("form-check form-switch", className)}>
      <input className="form-check-input" type="checkbox" role="switch" id={inputId} checked={checked} aria-label={label} {...rest} />
      <label htmlFor={inputId} aria-hidden="true">
        {checked ? dict.form.active : dict.form.inactive}
      </label>
    </span>
  );
}

/** Input group ODS : champ et bouton ou texte accolés. */
export function InputGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("input-group", className)}>{children}</div>;
}

export function InputGroupText({ children }: { children: ReactNode }) {
  return <span className="input-group-text">{children}</span>;
}

type QuantityProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  step: number;
  min?: number;
  max?: number;
  size?: "md" | "lg";
  /** Libellés des boutons : « Retirer 0,5 h », « Ajouter 0,5 h ». */
  decreaseLabel: string;
  increaseLabel: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  invalid?: boolean;
};

/** Quantity selector ODS : moins, champ, plus. */
export function QuantitySelector({ id, value, onChange, step, min = 0, max = 24, size = "md", decreaseLabel, increaseLabel, invalid, ...aria }: QuantityProps) {
  const current = Number(value.replace(",", ".")) || 0;
  const set = (n: number) => onChange(String(Math.min(max, Math.max(min, Math.round(n / step) * step))).replace(".", ","));
  const btnSize = size === "lg" ? "btn-lg" : null;
  return (
    <div className="quantity-selector">
      <button className={cx("btn btn-icon", btnSize)} type="button" aria-label={decreaseLabel} onClick={() => set(current - step)} disabled={current <= min}>
        <Icon name="minus" />
      </button>
      <input
        id={id}
        className={cx("form-control", size === "lg" && "form-control-lg", invalid && "is-invalid")}
        type="text"
        inputMode="decimal"
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        {...aria}
      />
      <button className={cx("btn btn-icon", btnSize)} type="button" aria-label={increaseLabel} onClick={() => set(current + step)} disabled={current >= max}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

/** Légende des champs obligatoires, à placer en tête de formulaire. */
export function RequiredLegend() {
  return <p className="small text-secondary">{dict.form.requiredLegend}</p>;
}
