// Champs de formulaire ODS : Input, Select, Textarea, Checkbox, Radio, Switch,
// Input group, Quantity selector. Label relié, aria-required, erreurs reliées
// par aria-describedby (PROMPT.md §14). Reproduits avec Tailwind (design/ods.css).
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/shared/lib/cx";
import { dict } from "@/shared/i18n";
import { Mark } from "./Display";
import { Icon } from "./Icon";

type FieldSize = "sm" | "md" | "lg";

type FieldFrame = {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /** Label présent pour les lecteurs d'écran mais masqué. */
  hideLabel?: boolean;
};

/** Contrôle ODS : bordure noire 2 px, texte gras, désactivé gris plein. */
export const CONTROL =
  "block w-full border-2 border-black bg-white px-10 font-bold text-black placeholder:font-normal placeholder:text-gray-595 " +
  "disabled:cursor-not-allowed disabled:border-gray-999 disabled:bg-gray-ddd disabled:text-gray-595 aria-invalid:border-danger";

const CONTROL_SIZES: Record<FieldSize, string> = {
  sm: "h-control-sm rounded-sm text-sm",
  md: "h-control rounded-md text-base",
  lg: "h-control-lg rounded-lg text-lead",
};

const LABEL = "mb-5 block font-bold";
const REQUIRED = "required-mark";
const HINT = "mt-5 text-sm text-gray-595";

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
    <p className="mt-5 flex items-start gap-5 text-sm font-bold text-danger" id={id}>
      <Mark tone="danger" />
      {children}
    </p>
  );
}

function Frame({ frame, ids, children }: { frame: FieldFrame; ids: ReturnType<typeof useFieldIds>; children: ReactNode }) {
  return (
    <div>
      <label className={cx(LABEL, frame.required && REQUIRED, frame.hideLabel && "sr-only")} htmlFor={ids.id}>
        {frame.label}
      </label>
      {children}
      {frame.hint && (
        <p className={HINT} id={ids.hintId}>
          {frame.hint}
        </p>
      )}
      {frame.error && <FieldError id={ids.errorId}>{frame.error}</FieldError>}
    </div>
  );
}

type InputProps = FieldFrame & Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: FieldSize };

/** Input ODS avec son label, son aide et son erreur. */
export function TextField({ label, required, hint, error, hideLabel, size = "md", className, id, "aria-describedby": extra, ...rest }: InputProps) {
  const ids = useFieldIds(id);
  return (
    <Frame frame={{ label, required, hint, error, hideLabel }} ids={ids}>
      <input
        id={ids.id}
        className={cx(CONTROL, CONTROL_SIZES[size], className)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids, extra)}
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
        className={cx(CONTROL, "min-h-textarea resize-y rounded-md p-10", className)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        {...rest}
      />
    </Frame>
  );
}

type SelectProps = FieldFrame & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: FieldSize };

export function SelectField({ label, required, hint, error, hideLabel, size = "md", className, id, children, ...rest }: SelectProps) {
  const ids = useFieldIds(id);
  return (
    <Frame frame={{ label, required, hint, error, hideLabel }} ids={ids}>
      <select
        id={ids.id}
        className={cx(CONTROL, CONTROL_SIZES[size], "cursor-pointer", className)}
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

const CHECK_INPUT =
  "peer size-20 flex-none cursor-pointer appearance-none border-2 border-black bg-white checked:bg-active " +
  "disabled:cursor-not-allowed disabled:border-gray-999 disabled:bg-gray-ddd";

function CheckFrame({ inputId, label, hint, control, className }: { inputId: string; label: ReactNode; hint?: ReactNode; control: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start gap-10", className)}>
      <span className="relative inline-flex flex-none">{control}</span>
      <span className="flex flex-col gap-5">
        <label className="cursor-pointer" htmlFor={inputId}>
          {label}
        </label>
        {hint && (
          <span className="text-sm text-gray-595" id={`${inputId}-aide`}>
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

/** Case à cocher ODS : carrée, coche noire sur orange de marque. */
export function Checkbox({ label, hint, id, className, ...rest }: CheckProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <CheckFrame
      inputId={inputId}
      label={label}
      hint={hint}
      className={className}
      control={
        <>
          <input className={cx(CHECK_INPUT, "rounded-none")} type="checkbox" id={inputId} aria-describedby={hint ? `${inputId}-aide` : undefined} {...rest} />
          <span className="pointer-events-none absolute inset-0 hidden text-black peer-checked:block" aria-hidden="true">
            <Icon name="check" />
          </span>
        </>
      }
    />
  );
}

/** Radio ODS : rond, point noir sur orange de marque. */
export function Radio({ label, hint, id, className, ...rest }: CheckProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <CheckFrame
      inputId={inputId}
      label={label}
      hint={hint}
      className={className}
      control={
        <>
          <input className={cx(CHECK_INPUT, "rounded-round")} type="radio" id={inputId} aria-describedby={hint ? `${inputId}-aide` : undefined} {...rest} />
          <span className="pointer-events-none absolute inset-5 hidden rounded-round bg-black peer-checked:block" aria-hidden="true" />
        </>
      }
    />
  );
}

/** Groupe de radios avec légende. */
export function RadioGroup({ legend, required, children }: { legend: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-10 border-0 p-0">
      <legend className={cx(LABEL, "p-0", required && REQUIRED)}>{legend}</legend>
      {children}
    </fieldset>
  );
}

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  /** Nom accessible de l'interrupteur (le texte visible est son état). */
  label: string;
  checked: boolean;
  /** État écrit à côté, selon la maquette : [actif, désactivé]. Par défaut : Actif / Désactivé. */
  states?: readonly [string, string];
  /** Texte de l'option écrit à côté, à la place de l'état (planches 12 et 14). */
  text?: ReactNode;
};

/** Switch ODS. Son état est écrit à côté (Actif / Désactivé), ou le texte de l'option. */
export function Switch({ label, checked, states = [dict.form.active, dict.form.inactive], text, id, className, ...rest }: SwitchProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <span className={cx("inline-flex items-center gap-10", className)}>
      <span className="relative inline-flex flex-none">
        <input
          className={cx(
            "peer h-control-sm w-switch cursor-pointer appearance-none rounded-sm border-2 border-black bg-white checked:bg-active",
            "disabled:cursor-not-allowed disabled:border-gray-999 disabled:bg-gray-ddd",
          )}
          type="checkbox"
          role="switch"
          id={inputId}
          checked={checked}
          aria-label={label}
          {...rest}
        />
        <span
          className="pointer-events-none absolute top-knob-inset left-knob-inset size-knob bg-black peer-checked:left-knob-on peer-disabled:bg-gray-999"
          aria-hidden="true"
        />
      </span>
      <label htmlFor={inputId} aria-hidden="true">
        {text ?? (checked ? states[0] : states[1])}
      </label>
    </span>
  );
}

/** Input group ODS : champ et bouton ou texte accolés. */
export function InputGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "flex [&>input]:min-w-0 [&>input]:flex-1 [&>input]:rounded-r-none [&>input]:border-r-0 [&>button]:rounded-l-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function InputGroupText({ children }: { children: ReactNode }) {
  return <span className="flex items-center rounded-r-md border-2 border-black bg-gray-ddd px-10 font-bold">{children}</span>;
}

type QuantityProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  step: number;
  min?: number;
  max?: number;
  size?: "md" | "lg";
  /** Libellés des boutons : « Retirer une journée », « Ajouter une journée ». */
  decreaseLabel: string;
  increaseLabel: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  invalid?: boolean;
};

const QTY_BUTTON =
  "inline-flex cursor-pointer items-center justify-center border-2 border-black bg-white text-black hover:bg-black hover:text-white " +
  "disabled:cursor-not-allowed disabled:border-gray-999 disabled:bg-gray-999 disabled:text-white";

/** Quantity selector ODS : moins, champ, plus. */
export function QuantitySelector({ id, value, onChange, step, min = 0, max = 24, size = "md", decreaseLabel, increaseLabel, invalid, ...aria }: QuantityProps) {
  const current = Number(value.replace(",", ".")) || 0;
  const set = (n: number) => onChange(String(Math.min(max, Math.max(min, Math.round(n / step) * step))).replace(".", ","));
  const box = size === "lg" ? "size-control-lg" : "size-control";
  const height = size === "lg" ? "h-control-lg text-lead" : "h-control";
  const [left, right] = size === "lg" ? ["rounded-l-lg", "rounded-r-lg"] : ["rounded-l-md", "rounded-r-md"];
  return (
    <div className="inline-flex">
      <button className={cx(QTY_BUTTON, box, left)} type="button" aria-label={decreaseLabel} onClick={() => set(current - step)} disabled={current <= min}>
        <Icon name="minus" />
      </button>
      <input
        id={id}
        className={cx(CONTROL, height, "w-quantity rounded-none border-x-0 text-center")}
        type="text"
        inputMode="decimal"
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        {...aria}
      />
      <button className={cx(QTY_BUTTON, box, right)} type="button" aria-label={increaseLabel} onClick={() => set(current + step)} disabled={current >= max}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

/** Légende des champs obligatoires, à placer en tête de formulaire. */
export function RequiredLegend() {
  return <p className="text-sm text-gray-595">{dict.form.requiredLegend}</p>;
}
