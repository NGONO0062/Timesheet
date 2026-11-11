// Écran 12, bloc « Jours fériés » (non maquetté : docs/design-v2.md §7). Un jour férié n'attend
// aucune saisie. Ajout par un formulaire (date jj/mm/aaaa, libellé) ; suppression tout de suite,
// avec « Annuler » (action réversible : pas de confirmation). Le serveur contrôle chaque champ.
import { useState, type FormEvent } from "react";
import { adminMessage, holidaysOfYear, holidayYears, ruleOf, useAddHoliday, useHolidays, useRemoveHoliday, type Holiday } from "@/entities/admin";
import { dict, t } from "@/shared/i18n";
import { capitalize, formatDate, formatFrDate, formatLongDate } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { Alert, Placeholder, Table } from "@/shared/ui/Display";
import { DateField, SelectField, TextField } from "@/shared/ui/Form";
import { EmptyState } from "@/shared/ui/States";

const h = dict.admin.holidays;
const IDS = { date: "jour-ferie-date", label: "jour-ferie-libelle" };

type Notice = { tone: "success" | "danger"; text: string; undo?: () => void } | null;

export function HolidaysSection() {
  const holidays = useHolidays();
  const add = useAddHoliday();
  const remove = useRemoveHoliday();
  // Année affichée : celle de l'horloge de l'application tant que rien n'est choisi.
  const [year, setYear] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [errors, setErrors] = useState<{ date?: string; label?: string }>({});
  const [notice, setNotice] = useState<Notice>(null);

  /** `restored` : jour férié remis par « Annuler » après une suppression. */
  function addHoliday(input: { date: string; label: string }, restored = false) {
    setNotice(null);
    add.mutate(input, {
      onSuccess: (r) => {
        const day = new Date(r.date);
        // La liste passe à l'année du jour ajouté, pour qu'il soit visible.
        setYear(day.getUTCFullYear());
        if (restored) {
          setNotice({ tone: "success", text: dict.admin.undone });
          return;
        }
        setErrors({});
        setDate("");
        setLabel("");
        const entered = r.enteredDays === 0 ? "" : ` ${r.enteredDays === 1 ? h.enteredOne : t(h.enteredMany, { n: r.enteredDays })}`;
        setNotice({ tone: "success", text: t(h.added, { date: formatLongDate(day), label: r.label }) + entered });
        // Prêt pour le jour férié suivant.
        document.getElementById(IDS.date)?.focus();
      },
      onError: (err) => {
        const rule = ruleOf(err);
        const dateError = rule.fields.includes("holidayDate") ? adminMessage("holidayDate") : rule.fields.includes("holidayTaken") ? adminMessage("holidayTaken") : undefined;
        const labelError = rule.fields.includes("holidayLabel") ? adminMessage("holidayLabel") : undefined;
        if (!restored && (dateError || labelError)) {
          setErrors({ date: dateError, label: labelError });
          document.getElementById(dateError ? IDS.date : IDS.label)?.focus();
        } else setNotice({ tone: "danger", text: adminMessage(rule.fields[0] ?? rule.code) });
      },
    });
  }

  function removeHoliday(row: Holiday) {
    setNotice(null);
    remove.mutate(row.id, {
      onSuccess: (r) => {
        const day = new Date(r.date);
        setNotice({ tone: "success", text: t(h.removed, { date: formatDate(day), label: r.label }), undo: () => addHoliday({ date: formatFrDate(day), label: r.label }, true) });
      },
      onError: (err) => setNotice({ tone: "danger", text: adminMessage(ruleOf(err).code) }),
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    addHoliday({ date, label });
  }

  const shown = year ?? holidays.data?.currentYear ?? null;
  const rows = holidays.data && shown !== null ? holidaysOfYear(holidays.data.rows, shown) : [];

  return (
    <section id="jours-feries" aria-labelledby="titre-jours-feries" className="flex scroll-mt-20 flex-col gap-20">
      <h2 id="titre-jours-feries">{h.title}</h2>
      <p>{h.intro}</p>

      {holidays.isPending ? (
        <>
          <p className="sr-only" role="status">
            {h.loading}
          </p>
          <Placeholder className="h-pad w-full" />
        </>
      ) : holidays.isError || shown === null ? (
        <Alert tone="danger" role="alert" heading={h.errorTitle} action={<Button onClick={() => void holidays.refetch()}>{dict.form.retry}</Button>}>
          <p>{dict.admin.errorText}</p>
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-20 gap-y-10">
            <div className="w-full md:w-status-col">
              <SelectField label={h.year} value={String(shown)} onChange={(e) => setYear(Number(e.target.value))}>
                {holidayYears(holidays.data.years, shown).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </SelectField>
            </div>
            {rows.length > 0 && <p>{t(rows.length > 1 ? h.countMany : h.countOne, { n: rows.length, year: shown })}</p>}
          </div>

          {notice && (
            <Alert
              tone={notice.tone}
              role={notice.tone === "danger" ? "alert" : "status"}
              onClose={() => setNotice(null)}
              action={
                notice.undo ? (
                  <Button
                    variant="link"
                    onClick={() => {
                      const undo = notice.undo;
                      setNotice(null);
                      undo?.();
                    }}
                  >
                    {dict.form.undo}
                  </Button>
                ) : undefined
              }
            >
              <p>{notice.text}</p>
            </Alert>
          )}

          {rows.length === 0 ? (
            <EmptyState title={t(h.empty, { year: shown })}>{h.emptyHint}</EmptyState>
          ) : (
            <Table caption={t(h.caption, { year: shown })}>
              <thead>
                <tr>
                  <th scope="col">{h.colDate}</th>
                  <th scope="col">{h.colLabel}</th>
                  <th scope="col">{h.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{capitalize(formatLongDate(new Date(r.date)))}</th>
                    <td>{r.label}</td>
                    <td>
                      <Button size="sm" disabled={remove.isPending} aria-label={t(h.removeLabel, { date: formatDate(new Date(r.date)), label: r.label })} onClick={() => removeHoliday(r)}>
                        {h.remove}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <form className="flex flex-col gap-20" onSubmit={onSubmit} noValidate aria-labelledby="titre-ajout-jour-ferie">
            <h3 id="titre-ajout-jour-ferie" className="text-h4">
              {h.addTitle}
            </h3>
            <div className="flex flex-col gap-20 md:flex-row md:items-start">
              <div className="w-full md:w-status-col">
                <DateField
                  id={IDS.date}
                  label={h.date}
                  required
                  value={date}
                  error={errors.date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setErrors((x) => ({ ...x, date: undefined }));
                  }}
                />
              </div>
              <div className="w-full md:w-filter">
                <TextField
                  id={IDS.label}
                  label={h.label}
                  required
                  hint={h.labelHint}
                  maxLength={80}
                  value={label}
                  error={errors.label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    setErrors((x) => ({ ...x, label: undefined }));
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={add.isPending}>
                {h.add}
              </Button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
