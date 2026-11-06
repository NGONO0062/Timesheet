// Grille de saisie hebdomadaire (planches C2-A et C2-B).
// Un vrai <table> : Tab passe à la cellule suivante, les flèches déplacent dans la grille.
import { useId, type KeyboardEvent } from "react";
import { dayStatus, dayTotals, overDayMessage, parseHours, sum } from "@/entities/timesheet";
import { cx } from "@/shared/lib/cx";
import { capitalize, formatDayMonth, formatDays, formatDaysOf, formatNumber, formatWeekdayDay } from "@/shared/lib/format";
import { dict, t } from "@/shared/i18n";
import { isoWeekday } from "@/shared/lib/iso-week";
import { Button } from "@/shared/ui/Button";
import { Mark } from "@/shared/ui/Display";
import { CONTROL, FieldError } from "@/shared/ui/Form";
import { Icon } from "@/shared/ui/Icon";
import { StatusBadge } from "@/shared/ui/StatusBadge";

export type GridRow = {
  id: string;
  project: string;
  activity: string;
  /** Saisie brute, une valeur par jour ouvré (« 1 », « »). */
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
  /** Cellule montrée avec le focus clavier : planches de /design seulement. */
  focusCell?: string;
};

const value = (raw: string | undefined, step: number) => {
  const p = parseHours(raw ?? "", step);
  return p.kind === "ok" ? p.value : 0;
};

// Cellules : 10 px, bordure grise sous chaque ligne, contenu centré ; en-tête et pied en noir.
const GRID =
  "w-full min-w-grid table-fixed border-collapse " +
  "[&_th]:border-b-2 [&_th]:border-gray-999 [&_th]:p-10 [&_th]:text-center [&_th]:align-middle " +
  "[&_td]:border-b-2 [&_td]:border-gray-999 [&_td]:p-10 [&_td]:text-center [&_td]:align-middle " +
  "[&_thead_th]:border-black [&_th:first-child]:w-3/11 [&_th:first-child]:text-left " +
  "[&_tbody_td]:font-bold [&_tbody_td]:tabular-nums " +
  "[&_tfoot_td]:border-t-2 [&_tfoot_td]:border-b-0 [&_tfoot_td]:border-t-black [&_tfoot_td]:bg-gray-fa [&_tfoot_td]:px-5 [&_tfoot_td]:font-bold " +
  "[&_tfoot_th]:border-t-2 [&_tfoot_th]:border-b-0 [&_tfoot_th]:border-t-black [&_tfoot_th]:bg-gray-fa";

const SUB = "block font-normal text-sm text-gray-595";

export function TimeGrid({ caption, days, expected, rows, step, readOnly, futureDays, onChange, onRemove, flaggedAnchor, onToggleFlag, focusCell }: Props) {
  const id = useId();
  const numbers = rows.map((r) => days.map((_, j) => value(r.values[j], step)));
  const totals = dayTotals(numbers, days.length);
  const flaggedDays = days.map((_, j) => rows.some((r) => r.flagged?.[j]));
  const statuses = days.map((_, j) => dayStatus({ total: totals[j] ?? 0, expected: expected[j] ?? 0, isFuture: futureDays?.[j], flagged: flaggedDays[j] }));
  const overDays = days.map((_, j) => statuses[j] === "OVER");
  const invalid = rows.map((r) => days.map((_, j) => parseHours(r.values[j] ?? "", step).kind === "invalid"));
  const anyInvalid = invalid.some((r) => r.some(Boolean));
  const at = (r: number, j: number) => numbers[r]?.[j] ?? 0;
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
            <small className={SUB}>{formatDayMonth(d)}</small>
          </th>
        ))}
        <th scope="col" className="w-grid-total">
          {dict.grid.total}
        </th>
        {!readOnly && (
          <th scope="col" className="w-control-lg pl-0">
            <span className="sr-only">{dict.grid.actions}</span>
          </th>
        )}
      </tr>
    </thead>
  );

  if (rows.length === 0) {
    return (
      <table className={GRID}>
        <caption className="sr-only">{caption}</caption>
        {head}
      </table>
    );
  }

  const firstFlag = rows.flatMap((row, r) => days.map((_, j) => (row.flagged?.[j] && !row.locked ? `${r}-${j}` : null))).find(Boolean);

  return (
    <>
      <table className={GRID}>
        <caption className="sr-only">{caption}</caption>
        {head}
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.id}>
              <th scope="row" className="font-bold">
                {row.project}
                <small className={SUB}>{row.locked && !readOnly ? t(dict.grid.entryClosed, { activity: row.activity }) : row.activity}</small>
              </th>
              {days.map((d, j) => {
                if (readOnly && onToggleFlag) {
                  const on = row.flagged?.[j] ?? false;
                  return (
                    <td key={j}>
                      <button
                        className={cx(
                          "inline-flex min-h-control min-w-cell cursor-pointer items-center justify-center gap-5 rounded-md border-2 bg-white px-10 font-bold text-black hover:border-black hover:bg-black hover:text-white",
                          on ? "border-danger" : "border-black",
                        )}
                        type="button"
                        aria-pressed={on}
                        aria-label={t(dict.validation.flagCell, { project: row.project, day: formatWeekdayDay(d), hours: formatDays(at(r, j)) })}
                        onClick={() => onToggleFlag(row.id, j)}
                      >
                        {on && <Mark tone="danger" />}
                        {formatNumber(at(r, j))}
                      </button>
                    </td>
                  );
                }
                if (readOnly || row.locked) {
                  return (
                    <td key={j} className="bg-white">
                      {row.flagged?.[j] ? (
                        <span className="inline-flex min-h-control-sm items-center justify-center gap-5 rounded-md border-2 border-danger px-10 font-bold">
                          <Mark tone="danger" />
                          {formatNumber(at(r, j))}
                        </span>
                      ) : (
                        formatNumber(at(r, j))
                      )}
                    </td>
                  );
                }
                const flagged = row.flagged?.[j] ?? false;
                const over = (overDays[j] ?? false) && at(r, j) > 0;
                const bad = invalid[r]?.[j] ?? false;
                const describedBy = cx(flagged && ids.flag(r, j), over && ids.over(j), bad && ids.invalid) || undefined;
                return (
                  <td key={j}>
                    <input
                      id={flaggedAnchor && firstFlag === `${r}-${j}` ? flaggedAnchor : undefined}
                      data-cell={`${r}-${j}`}
                      className={cx(CONTROL, "h-control rounded-md text-center", focusCell === `${r}-${j}` && "focus-ring")}
                      type="text"
                      inputMode="numeric"
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
              <td className="bg-gray-fa">{formatDays(sum(numbers[r] ?? []))}</td>
              {!readOnly && (
                <td className="pl-0">
                  {!row.locked && (
                    <Button size="sm" className="w-control-sm px-0" aria-label={t(dict.grid.removeLine, { project: row.project })} onClick={() => onRemove?.(row.id)}>
                      <Icon name="cross" />
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="font-bold">
              {dict.grid.dayTotal}
            </th>
            {days.map((_, j) =>
              readOnly ? (
                <td key={j}>{formatDaysOf(totals[j] ?? 0, expected[j] ?? 0)}</td>
              ) : (
                <td key={j}>
                  <span className="flex flex-col items-center gap-5">
                    {formatDaysOf(totals[j] ?? 0, expected[j] ?? 0)}
                    <StatusBadge kind="day" value={statuses[j] ?? "UPCOMING"} className="px-5" />
                  </span>
                </td>
              ),
            )}
            <td>{formatDaysOf(sum(totals), sum(expected))}</td>
            {!readOnly && <td />}
          </tr>
        </tfoot>
      </table>
      {!readOnly && (overDays.some(Boolean) || flaggedDays.some(Boolean) || anyInvalid) && (
        <div className="mt-20 flex flex-col gap-5">
          {days.map((d, j) =>
            overDays[j] ? (
              <FieldError key={`o${j}`} id={ids.over(j)}>
                {overDayMessage(d, totals[j] ?? 0, expected[j] ?? 0)}
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
                    hours: formatDays(at(r, j)),
                  })}
                </FieldError>
              ) : null,
            ),
          )}
          {anyInvalid && <FieldError id={ids.invalid}>{t(dict.grid.invalidNumber, { step: formatDays(step) })}</FieldError>}
        </div>
      )}
    </>
  );
}
