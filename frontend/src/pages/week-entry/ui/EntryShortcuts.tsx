// Raccourcis de saisie (docs/design-v2.md §1, non maquettés) : reprendre les choix de la
// dernière semaine saisie, jour par jour, ou remplir les jours vides avec un même projet.
// Seuls les jours encore vides changent. Action réversible : un message avec « Annuler ».
import { useState } from "react";
import { choiceLabel, copyPrevious, fillEmptyDays, type DayValue, type Week } from "@/entities/timesheet";
import { dict, t } from "@/shared/i18n";
import { Button } from "@/shared/ui/Button";
import { Alert } from "@/shared/ui/Display";
import { SelectField } from "@/shared/ui/Form";

const d = dict.dayEntry;

/** `revert` : ce que le raccourci a changé, pour « Annuler ». */
type Notice = { text: string; revert?: { before: DayValue[]; after: DayValue[] } };

export function EntryShortcuts({ week, values, onApply }: { week: Week; values: DayValue[]; onApply: (next: DayValue[]) => void }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const expected = week.days.map((x) => x.expected);
  const previous = week.days.map((x) => x.previous);
  const open = week.choices.filter((c) => !c.closed);
  const copy = week.copyFrom ? copyPrevious(values, expected, previous) : null;
  const hasEmpty = values.some((v, j) => !v && (expected[j] ?? 0) > 0);

  function apply(next: DayValue[], text: string) {
    onApply(next);
    setNotice({ text, revert: { before: values, after: next } });
  }

  /** « Annuler » : seuls les jours posés par le raccourci, et non modifiés depuis, reviennent. */
  function undo(revert: { before: DayValue[]; after: DayValue[] }) {
    onApply(values.map((v, j) => (revert.after[j] !== revert.before[j] && v === revert.after[j] ? (revert.before[j] ?? null) : v)));
    setNotice({ text: d.shortcutUndone });
  }

  const canCopy = copy !== null && copy.count > 0 && week.copyFrom !== null;
  if (!canCopy && !hasEmpty && !notice) return null;

  return (
    <div className="flex flex-col gap-10">
      {(canCopy || hasEmpty) && (
        <div className="flex flex-wrap items-end gap-x-20 gap-y-10" role="group" aria-label={d.shortcuts}>
          {canCopy && (
            <Button
              className="w-full md:w-auto"
              onClick={() => apply(copy.values, t(copy.count > 1 ? d.copiedMany : d.copiedOne, { n: copy.count, week: week.copyFrom?.week ?? "" }))}
            >
              {t(d.copyPrevious, { week: week.copyFrom?.week ?? "" })}
            </Button>
          )}
          {hasEmpty && open.length > 0 && (
            <div className="w-full md:w-filter">
              <SelectField
                label={d.fillEmpty}
                value=""
                onChange={(e) => {
                  const choice = open.find((c) => c.key === e.target.value);
                  if (!choice) return;
                  const r = fillEmptyDays(values, expected, choice.key);
                  apply(r.values, t(r.count > 1 ? d.filledMany : d.filledOne, { n: r.count, project: choiceLabel(choice) }));
                }}
              >
                <option value="">{d.fillChoose}</option>
                {open.map((c) => (
                  <option key={c.key} value={c.key}>
                    {choiceLabel(c)}
                  </option>
                ))}
              </SelectField>
            </div>
          )}
        </div>
      )}
      {notice && (
        <Alert
          tone="success"
          role="status"
          onClose={() => setNotice(null)}
          action={
            notice.revert ? (
              <Button variant="link" onClick={() => notice.revert && undo(notice.revert)}>
                {dict.form.undo}
              </Button>
            ) : undefined
          }
        >
          <p>{notice.text}</p>
        </Alert>
      )}
    </div>
  );
}
