"use client";
// Grille de saisie hebdomadaire (.ts-grid, planches C2-A et C2-B).
// Un vrai <table> : Tab passe à la cellule suivante, les flèches déplacent dans la grille.
import { useId, type KeyboardEvent } from "react";
import { FieldError } from "@/components/ods/Form";
import { Icon, Mark } from "@/components/ods/Icon";
import { cx } from "@/lib/cx";
import { capitalize, formatDayMonth, formatHours, formatHoursOf, formatNumber, formatWeekdayDay } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { isoWeekday } from "@/lib/iso-week";
import { dayStatus, dayTotals, overDayMessage, parseHours, sum } from "@/lib/timesheet/rules";
import { StatusBadge } from "./StatusBadge";

export type GridRow = {
  id: string;
  project: string;
  activity: string;
  /** Saisie brute, une valeur par jour ouvré (« 3,5 », « »). */
  values: string[];
  /** Cellules signalées par le manager lors d'un rejet. */
  flagged?: boolean[];
  /** Projet sorti de « En cours » : ligne visible en lecture seule. */
  locked?: boolean;
};

type Props = {
  caption: string;
  days: Date[];
  expected: number[];
  rows: GridRow[];
  step: number;
  readOnly?: boolean;
  /** Jours futurs : « À venir » tant que rien n'est saisi. */
  futureDays?: boolean[];
  onChange?: (rowId: string, day: number, raw: string) => void;
  onRemove?: (rowId: string) => void;
  /** Identifiant posé sur la première cellule signalée (lien « Aller à la cellule signalée »). */
  flaggedAnchor?: string;
  /** Lecture seule, côté manager : chaque cellule devient un bouton qui la signale. */
  onToggleFlag?: (rowId: string, day: number) => void;
};

const value = (raw: string | undefined, step: number) => {
  const p = parseHours(raw ?? "", step);
  return p.kind === "ok" ? p.value : 0;
};

export function TimeGrid({ caption, days, expected, rows, step, readOnly, futureDays, onChange, onRemove, flaggedAnchor, onToggleFlag }: Props) {
  const id = useId();
  const numbers = rows.map((r) => days.map((_, j) => value(r.values[j], step)));
  const totals = dayTotals(numbers, days.length);
  const flaggedDays = days.map((_, j) => rows.some((r) => r.flagged?.[j]));
  const statuses = days.map((_, j) =>
    dayStatus({ total: totals[j] ?? 0, expected: expected[j] ?? 0, isFuture: futureDays?.[j], flagged: flaggedDays[j] }),
  );
  const overDays = days.map((_, j) => statuses[j] === "OVER");
  const invalid = rows.map((r) => days.map((_, j) => parseHours(r.values[j] ?? "", step).kind === "invalid"));
  const anyInvalid = invalid.some((r) => r.some(Boolean));
  const ids = {
    over: (j: number) => `${id}-depassement-${j}`,
    flag: (r: number, j: number) => `${id}-signal-${r}-${j}`,
    invalid: `${id}-invalide`,
  };

  function onKey(e: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const move = moves[e.key];
    if (!move) return;
    const input = e.currentTarget;
    // Gauche / droite déplacent seulement quand le curseur est en bout de champ.
    if (move[1] === -1 && input.selectionStart !== 0) return;
    if (move[1] === 1 && input.selectionEnd !== input.value.length) return;
    const target = input.closest("table")?.querySelector<HTMLInputElement>(`[data-cell="${r + move[0]}-${c + move[1]}"]`);
    if (target) {
      e.preventDefault();
      target.focus();
      target.select();
    }
  }

  const head = (
    <thead>
      <tr>
        <th scope="col">{dict.grid.projectActivity}</th>
        {days.map((d) => (
          <th scope="col" key={d.toISOString()}>
            {dict.weekdaysShort[isoWeekday(d)]}
            <small>{formatDayMonth(d)}</small>
          </th>
        ))}
        <th scope="col" className="ts-col-total">{dict.grid.total}</th>
        {!readOnly && (
          <th scope="col" className="ts-col-act">
            <span className="visually-hidden">{dict.grid.actions}</span>
          </th>
        )}
      </tr>
    </thead>
  );

  if (rows.length === 0) {
    return (
      <table className="ts-grid">
        <caption className="visually-hidden">{caption}</caption>
        {head}
      </table>
    );
  }

  const weekTotal = sum(totals);
  const firstFlag = rows.flatMap((row, r) => days.map((_, j) => (row.flagged?.[j] && !row.locked ? `${r}-${j}` : null))).find(Boolean);
  const weekExpected = sum(expected);

  return (
    <>
      <table className={cx("ts-grid", readOnly && "is-readonly")}>
        <caption className="visually-hidden">{caption}</caption>
        {head}
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.id}>
              <th scope="row">
                {row.project}
                <small>{row.locked && !readOnly ? t(dict.grid.entryClosed, { activity: row.activity }) : row.activity}</small>
              </th>
              {days.map((d, j) => {
                if (readOnly && onToggleFlag) {
                  const on = row.flagged?.[j] ?? false;
                  return (
                    <td key={j}>
                      <button
                        className="ts-flag-toggle"
                        type="button"
                        aria-pressed={on}
                        aria-label={t(dict.validation.flagCell, { project: row.project, day: formatWeekdayDay(d), hours: formatHours(numbers[r]![j]!) })}
                        onClick={() => onToggleFlag(row.id, j)}
                      >
                        {on && <Mark tone="danger" />}
                        {formatNumber(numbers[r]![j]!)}
                      </button>
                    </td>
                  );
                }
                if (readOnly || row.locked) {
                  return (
                    <td key={j}>
                      {row.flagged?.[j] ? (
                        <span className="ts-flag">
                          <Mark tone="danger" />
                          {formatNumber(numbers[r]![j]!)}
                        </span>
                      ) : (
                        formatNumber(numbers[r]![j]!)
                      )}
                    </td>
                  );
                }
                const flagged = row.flagged?.[j] ?? false;
                const over = overDays[j]! && numbers[r]![j]! > 0;
                const bad = invalid[r]![j]!;
                const describedBy = cx(flagged && ids.flag(r, j), over && ids.over(j), bad && ids.invalid) || undefined;
                return (
                  <td key={j}>
                    <input
                      id={flaggedAnchor && firstFlag === `${r}-${j}` ? flaggedAnchor : undefined}
                      data-cell={`${r}-${j}`}
                      className={cx("form-control", (flagged || over || bad) && "is-invalid")}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      value={row.values[j] ?? ""}
                      aria-label={t(dict.grid.cellLabel, { project: row.project, day: formatWeekdayDay(d) })}
                      aria-invalid={flagged || over || bad ? true : undefined}
                      aria-describedby={describedBy}
                      onChange={(e) => onChange?.(row.id, j, e.target.value)}
                      onKeyDown={(e) => onKey(e, r, j)}
                    />
                  </td>
                );
              })}
              <td className="ts-total">{formatHours(sum(numbers[r]!))}</td>
              {!readOnly && (
                <td className="ts-col-act">
                  {!row.locked && (
                    <button
                      className="btn btn-icon btn-sm"
                      type="button"
                      aria-label={t(dict.grid.removeLine, { project: row.project })}
                      onClick={() => onRemove?.(row.id)}
                    >
                      <Icon name="cross" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{dict.grid.dayTotal}</th>
            {days.map((_, j) =>
              readOnly ? (
                <td key={j}>{formatHoursOf(totals[j]!, expected[j]!)}</td>
              ) : (
                <td key={j}>
                  <span className="ts-day">
                    {formatHoursOf(totals[j]!, expected[j]!)}
                    <StatusBadge kind="day" value={statuses[j]!} />
                  </span>
                </td>
              ),
            )}
            <td>{formatHoursOf(weekTotal, weekExpected)}</td>
            {!readOnly && <td className="ts-col-act" />}
          </tr>
        </tfoot>
      </table>
      {!readOnly && (
        <>
          {days.map((d, j) =>
            overDays[j] ? (
              <FieldError key={`o${j}`} id={ids.over(j)}>
                {overDayMessage(d, totals[j]!, expected[j]!)}
              </FieldError>
            ) : null,
          )}
          {rows.flatMap((row, r) =>
            days.map((d, j) =>
              row.flagged?.[j] ? (
                <FieldError key={`f${r}-${j}`} id={ids.flag(r, j)}>
                  {t(dict.grid.flagged, {
                    day: `${capitalize(formatWeekdayDay(d))} ${dict.months[d.getUTCMonth()]}`,
                    project: row.project,
                    hours: formatHours(numbers[r]![j]!),
                  })}
                </FieldError>
              ) : null,
            ),
          )}
          {anyInvalid && <FieldError id={ids.invalid}>{t(dict.grid.invalidNumber, { step: formatHours(step) })}</FieldError>}
        </>
      )}
    </>
  );
}
