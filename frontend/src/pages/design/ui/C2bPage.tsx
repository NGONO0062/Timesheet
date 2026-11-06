import type { ReactNode } from "react";
import type { TimesheetStatus } from "@/shared/lib/status";
import { Button } from "@/shared/ui/Button";
import { Alert } from "@/shared/ui/Display";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { TimeGrid } from "@/widgets/time-grid";
import { DAYS, EXPECTED, STEP, row, useGrid } from "./grid-demo";
import { Planche } from "./Planche";

// Planche C2-Grille-etats-B : soumise, rejetée, validée.
const SUBMITTED = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["1", "1", "", "", ""]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["", "", "1", "1", ""]),
  row("r3", "Cartographie des irritants", "Atelier", ["", "", "", "", "1"]),
];
const REJECTED = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["1", "1", "", "1", ""], [false, false, false, true, false]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["", "", "1", "", ""]),
  row("r3", "Cartographie des irritants", "Atelier", ["", "", "", "", "1"]),
];

function Section({ title, status, children }: { title: string; status: TimesheetStatus; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-20">
      <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
        <h2 className="text-h3">{title}</h2>
        <StatusBadge kind="timesheet" value={status} />
      </div>
      {children}
    </section>
  );
}

function Rejected() {
  const g = useGrid(REJECTED);
  return (
    <>
      <TimeGrid caption="Grille rejetée, de nouveau modifiable, une cellule signalée" days={DAYS} expected={EXPECTED} rows={g.rows} step={STEP} onChange={g.onChange} onRemove={g.onRemove} />
      <div className="flex justify-end">
        <Button variant="primary" disabled={!g.check.canSubmit}>
          Soumettre à nouveau
        </Button>
      </div>
    </>
  );
}

export function C2bPage() {
  return (
    <Planche
      className="gap-60"
      title="Grille de saisie hebdomadaire"
      lead="États après soumission : soumise, rejetée, validée. En lecture seule, les champs deviennent du texte, pas des champs désactivés."
    >
      <Section title="4. Soumise" status="SUBMITTED">
        <Alert tone="info">
          <p>Soumise le 20 mars 2026 à 16:42. En attente de validation par Samuel Etoga. La fiche n&apos;est plus modifiable.</p>
        </Alert>
        <TimeGrid caption="Grille soumise, en lecture seule" days={DAYS} expected={EXPECTED} rows={SUBMITTED} step={STEP} readOnly />
      </Section>
      <Section title="5. Rejetée" status="REJECTED">
        <Alert tone="danger" role="alert" heading="Fiche rejetée par Samuel Etoga, le 23 mars 2026 à 09:15">
          <p>Motif : « Jeudi 19 mars, journée déclarée sur Refonte parcours souscription alors que l&apos;atelier de tests a été annulé. Merci de réaffecter cette journée. »</p>
        </Alert>
        <Rejected />
      </Section>
      <Section title="6. Validée" status="VALIDATED">
        <Alert tone="success">
          <p>Validée par Samuel Etoga le 24 mars 2026 à 11:30. La fiche est verrouillée et sera reprise dans la fiche de présence de mars 2026.</p>
        </Alert>
        <TimeGrid caption="Grille validée, en lecture seule" days={DAYS} expected={EXPECTED} rows={SUBMITTED} step={STEP} readOnly />
      </Section>
    </Planche>
  );
}
