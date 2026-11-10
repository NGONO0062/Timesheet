// Écran 04 : confirmation de la soumission, avec le récapitulatif par projet et activité.
import { choiceLabel, dayOf, type DayValue, type Week } from "@/entities/timesheet";
import { dict, t } from "@/shared/i18n";
import { formatDays, formatRange } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { Alert, Table } from "@/shared/ui/Display";
import { Modal } from "@/shared/ui/Overlay";

const e = dict.entry;

export function SubmitDialog({ open, week, values, pending, onClose, onConfirm }: {
  open: boolean;
  week: Week;
  values: DayValue[];
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const days = week.days.map((d) => dayOf(d.date));
  const first = days[0];
  const last = days[days.length - 1];
  const byChoice = new Map<string, number>();
  values.forEach((v) => {
    if (v) byChoice.set(v, (byChoice.get(v) ?? 0) + 1);
  });
  const rows = week.choices.filter((c) => byChoice.has(c.key));
  const total = [...byChoice.values()].reduce((a, b) => a + b, 0);
  const expected = week.days.filter((d) => d.expected > 0).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(e.modalTitle, { week: week.week })}
      footer={
        <>
          <Button onClick={onClose}>{dict.form.cancel}</Button>
          <Button variant="primary" disabled={pending} onClick={onConfirm}>
            {pending ? e.submitting : e.confirm}
          </Button>
        </>
      }
    >
      <p>{e.modalIntro}</p>
      <dl className="grid grid-cols-trace gap-x-20 gap-y-10">
        <dt className="text-gray-595">{e.period}</dt>
        <dd className="font-bold">{first && last ? formatRange(first, last) : ""}</dd>
        <dt className="text-gray-595">{e.validator}</dt>
        <dd className="font-bold">{week.validator ? t(e.validatorName, { name: week.validator, role: "manager" }) : "—"}</dd>
      </dl>
      <Table caption={t(e.modalCaption, { week: week.week })} responsive={false}>
        <thead>
          <tr>
            <th scope="col">{dict.dayEntry.assignment}</th>
            <th scope="col" className="text-right">
              {e.modalHours}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.key}>
              <td>{choiceLabel(c)}</td>
              <td className="text-right tabular-nums">{formatDays(byChoice.get(c.key) ?? 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{e.weekTotal}</th>
            <td className="text-right">{t(e.totalOf, { total: formatDays(total), expected: formatDays(expected) })}</td>
          </tr>
        </tfoot>
      </Table>
      <Alert tone="info">
        <p>{e.modalInfo}</p>
      </Alert>
    </Modal>
  );
}
