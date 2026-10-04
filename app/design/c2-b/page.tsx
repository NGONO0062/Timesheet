"use client";
import { Alert, Button } from "@/components/ods";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { TimeGrid } from "@/components/ts/TimeGrid";
import { Planche } from "../Planche";
import { DAYS, EXPECTED, STEP, row, useGrid } from "../grid-demo";

// Planche C2-Grille-etats-B : soumise, rejetée, validée.
const SUBMITTED = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["4", "4", "3", "5", "4"]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["2", "4", "3", "3", "2"]),
  row("r3", "Cartographie des irritants", "Atelier", ["2", "0", "2", "0", "2"]),
];
const REJECTED = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["4", "4", "3", "5", "4"], [false, false, false, true, false]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["2", "4", "3", "3", "2"]),
  row("r3", "Cartographie des irritants", "Atelier", ["2", "0", "2", "0", "2"]),
];
const VALIDATED = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["4", "4", "3", "0", "4"]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["2", "4", "3", "5", "2"]),
  row("r3", "Cartographie des irritants", "Atelier", ["2", "0", "2", "3", "2"]),
];

const sectionStyle = { display: "flex", flexDirection: "column", gap: 20 } as const;
const headStyle = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 20px" } as const;

function Rejected() {
  const g = useGrid(REJECTED);
  return (
    <>
      <TimeGrid caption="Grille rejetée, de nouveau modifiable, une cellule signalée" days={DAYS} expected={EXPECTED} rows={g.rows} step={STEP} onChange={g.onChange} onRemove={g.onRemove} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" disabled={!g.check.canSubmit}>Soumettre à nouveau</Button>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Planche title="Grille de saisie hebdomadaire" lead="États après soumission : soumise, rejetée, validée. En lecture seule, les champs deviennent du texte, pas des champs désactivés." gap={60} minHeight={1770}>
      <section style={sectionStyle}>
        <div style={headStyle}>
          <h2 className="h3">4. Soumise</h2>
          <StatusBadge kind="timesheet" value="SUBMITTED" />
        </div>
        <Alert tone="info">
          <p>Soumise le 20 mars 2026 à 16:42. En attente de validation par Samuel Etoga. La fiche n&apos;est plus modifiable.</p>
        </Alert>
        <TimeGrid caption="Grille soumise, en lecture seule" days={DAYS} expected={EXPECTED} rows={SUBMITTED} step={STEP} readOnly />
      </section>
      <section style={sectionStyle}>
        <div style={headStyle}>
          <h2 className="h3">5. Rejetée</h2>
          <StatusBadge kind="timesheet" value="REJECTED" />
        </div>
        <Alert tone="danger" role="alert" heading="Fiche rejetée par Samuel Etoga, le 23 mars 2026 à 09:15">
          <p>Motif : « Jeudi 19 mars, 5 h déclarées sur Refonte parcours souscription alors que l&apos;atelier de tests a été annulé. Merci de réaffecter ces heures. »</p>
        </Alert>
        <Rejected />
      </section>
      <section style={sectionStyle}>
        <div style={headStyle}>
          <h2 className="h3">6. Validée</h2>
          <StatusBadge kind="timesheet" value="VALIDATED" />
        </div>
        <Alert tone="success">
          <p>Validée par Samuel Etoga le 24 mars 2026 à 11:30. La fiche est verrouillée et sera reprise dans la fiche de présence de mars 2026.</p>
        </Alert>
        <TimeGrid caption="Grille validée, en lecture seule" days={DAYS} expected={EXPECTED} rows={VALIDATED} step={STEP} readOnly />
      </section>
    </Planche>
  );
}
