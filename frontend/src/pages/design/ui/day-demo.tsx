// Données de démonstration des planches C2 (semaine 12 de 2026), saisie par jour.
import { useState } from "react";
import { daySummary, expectedPerDay, type DayChoice, type DayValue } from "@/entities/timesheet";
import { utcDate } from "@/shared/lib/iso-week";
import { Button } from "@/shared/ui/Button";
import { Progress } from "@/shared/ui/Display";

export const DAYS = [16, 17, 18, 19, 20].map((d) => utcDate(2026, 3, d));
export const EXPECTED = expectedPerDay(DAYS, 1);

export const CHOICES: DayChoice[] = [
  { key: "souscription-tests", project: "Refonte parcours souscription", activity: "Tests utilisateurs" },
  { key: "souscription-atelier", project: "Refonte parcours souscription", activity: "Atelier" },
  { key: "nps-analyse", project: "Baromètre NPS T1 2026", activity: "Analyse" },
  { key: "irritants-atelier", project: "Cartographie des irritants", activity: "Atelier" },
  { key: "veille-formation", project: "Veille et formation", activity: "Formation" },
  { key: "absence", project: "Absence", activity: "Absence" },
];

export function useDays(initial: DayValue[]) {
  const [values, setValues] = useState(initial);
  return {
    values,
    summary: daySummary(DAYS, EXPECTED, values),
    onChange: (day: number, value: DayValue) => setValues((vs) => vs.map((v, k) => (k === day ? value : v))),
  };
}

/** Bas de la saisie : bilan, barre, raison écrite à côté du bouton tant qu'il manque un jour. */
export function SubmitBar({ summary, submitLabel = "Soumettre la semaine" }: { summary: ReturnType<typeof daySummary>; submitLabel?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-30 gap-y-20 border-t-2 border-black pt-20">
      <div className="flex min-w-0 flex-1 flex-col gap-10">
        <p className="text-h4 font-bold">{summary.label}</p>
        <Progress value={(summary.filled / Math.max(1, summary.expected)) * 100} label={summary.label} tone={summary.check.canSubmit ? "success" : undefined} />
        <p className="text-sm">{summary.check.message}</p>
      </div>
      <Button variant="primary" disabled={!summary.check.canSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}
