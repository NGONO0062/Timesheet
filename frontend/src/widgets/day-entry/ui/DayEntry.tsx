// Saisie par jour (docs/design-v2.md, remplace la grille projets × jours des planches C2).
// Une ligne par jour ouvré : le jour, le projet et l'activité, le statut. Même disposition
// au bureau et sur mobile. En lecture seule, le choix devient du texte ; côté manager,
// chaque journée saisie peut être signalée.
import { useId } from "react";
import { choiceLabel, dayEntryStatus, type DayChoice, type DayValue } from "@/entities/timesheet";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { capitalize, formatDayMonth, formatWeekdayDay } from "@/shared/lib/format";
import { isoWeekday } from "@/shared/lib/iso-week";
import { Mark } from "@/shared/ui/Display";
import { CONTROL, FieldError } from "@/shared/ui/Form";
import { StatusBadge } from "@/shared/ui/StatusBadge";

type Props = {
  caption: string;
  days: Date[];
  /** 1 par jour ouvré, 0 pour un jour férié de la division. */
  expected: number[];
  choices: DayChoice[];
  values: DayValue[];
  onChange?: (day: number, value: DayValue) => void;
  readOnly?: boolean;
  /** Jours futurs : « À venir » tant que rien n'est choisi. */
  futureDays?: boolean[];
  /** Journées signalées par le manager lors d'un rejet. */
  flagged?: boolean[];
  /** Côté manager (lecture seule) : chaque journée saisie devient un bouton qui la signale. */
  onToggleFlag?: (day: number) => void;
  /** Identifiant posé sur la première journée signalée (lien « Aller à la journée signalée »). */
  flaggedAnchor?: string;
};

const HEAD = "border-b-2 border-black p-10 text-left font-bold whitespace-nowrap";
// Mobile : une ligne flexible par jour ; bureau (768 px et plus) : une vraie ligne de tableau.
const ROW = "flex flex-wrap items-center gap-x-10 gap-y-5 border-b-2 border-gray-999 py-10 md:table-row md:py-0";
const CELL = "md:table-cell md:border-b-2 md:border-gray-999 md:p-10 md:align-middle";

export function DayEntry({ caption, days, expected, choices, values, onChange, readOnly, futureDays, flagged, onToggleFlag, flaggedAnchor }: Props) {
  const id = useId();
  const byKey = new Map(choices.map((c) => [c.key, c]));
  const label = (value: DayValue) => {
    const choice = value ? byKey.get(value) : undefined;
    return choice ? choiceLabel(choice) : null;
  };
  const dayName = (d: Date) => `${capitalize(formatWeekdayDay(d))} ${dict.months[d.getUTCMonth()] ?? ""}`;
  const firstFlag = flagged?.findIndex(Boolean) ?? -1;

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">{caption}</caption>
      {/* Mobile : en-têtes masqués, chaque jour sur deux lignes (jour et statut, puis le choix). */}
      <thead className="hidden md:table-header-group">
        <tr>
          <th scope="col" className={cx(HEAD, "w-status-col")}>
            {dict.dayEntry.day}
          </th>
          <th scope="col" className={HEAD}>
            {dict.dayEntry.assignment}
          </th>
          <th scope="col" className={cx(HEAD, "w-status-col")}>
            {dict.dayEntry.status}
          </th>
        </tr>
      </thead>
      <tbody>
        {days.map((d, j) => {
          const holiday = (expected[j] ?? 0) === 0;
          const value = values[j] ?? null;
          const isFlagged = flagged?.[j] ?? false;
          const errorId = `${id}-signal-${j}`;
          const text = label(value);
          return (
            <tr key={d.toISOString()} className={ROW}>
              <th scope="row" className={cx(CELL, "flex-1 text-left font-bold whitespace-nowrap")}>
                {dict.weekdaysShort[isoWeekday(d)]}
                <small className="block text-sm font-normal text-gray-595">{formatDayMonth(d)}</small>
              </th>
              <td className={cx(CELL, "order-last basis-full")}>
                {holiday ? (
                  <span className="text-gray-595">{dict.dayEntry.holiday}</span>
                ) : readOnly && onToggleFlag && value ? (
                  <button
                    className={cx(
                      "inline-flex min-h-control cursor-pointer items-center gap-5 rounded-md border-2 bg-white px-10 py-5 text-left text-black hover:border-black hover:bg-black hover:text-white",
                      isFlagged ? "border-danger" : "border-black",
                    )}
                    type="button"
                    aria-pressed={isFlagged}
                    aria-label={t(dict.dayEntry.flagDay, { day: dayName(d), project: text ?? "" })}
                    onClick={() => onToggleFlag(j)}
                  >
                    {isFlagged && <Mark tone="danger" />}
                    {text}
                  </button>
                ) : readOnly ? (
                  <span className={cx(isFlagged && "inline-flex items-center gap-5 rounded-md border-2 border-danger px-10 py-5")}>
                    {isFlagged && <Mark tone="danger" />}
                    {text ?? <span className="text-gray-595">{dict.dayEntry.notEntered}</span>}
                  </span>
                ) : (
                  <>
                    <select
                      id={flaggedAnchor && firstFlag === j ? flaggedAnchor : undefined}
                      className={cx(CONTROL, "h-control-lg cursor-pointer rounded-md md:h-control")}
                      value={value ?? ""}
                      aria-label={t(dict.dayEntry.selectLabel, { day: dayName(d) })}
                      aria-invalid={isFlagged || undefined}
                      aria-describedby={isFlagged ? errorId : undefined}
                      onChange={(e) => onChange?.(j, e.target.value || null)}
                    >
                      <option value="">{dict.dayEntry.choose}</option>
                      {choices.map((c) => (
                        <option key={c.key} value={c.key} disabled={c.closed && c.key !== value}>
                          {choiceLabel(c)}
                        </option>
                      ))}
                    </select>
                    {isFlagged && (
                      <FieldError id={errorId}>{t(dict.dayEntry.flagged, { day: dayName(d), project: text ?? dict.dayEntry.notEntered })}</FieldError>
                    )}
                  </>
                )}
              </td>
              <td className={CELL}>{!holiday && <StatusBadge kind="day" value={dayEntryStatus({ value, isFuture: futureDays?.[j], flagged: isFlagged })} />}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
