"use client";
import { Button } from "@/components/ods";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { EmptyState, SaveIndicator } from "@/components/ts/States";
import { TimeGrid } from "@/components/ts/TimeGrid";
import { Planche } from "../Planche";
import { DAYS, EXPECTED, STEP, row, useGrid } from "../grid-demo";

// Planche C2-Grille-etats-A : vide, partielle, dépassement, complète.
const PARTIAL = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["4", "4", "3", "", ""]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["2", "4", "3", "", ""]),
  row("r3", "Cartographie des irritants", "Atelier", ["2", "0", "2", "", ""]),
];
const OVER = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["4", "4", "5", "", ""]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["4", "4", "5", "", ""]),
];
const COMPLETE = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["4", "4", "3", "5", "4"]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["2", "4", "3", "3", "2"]),
  row("r3", "Cartographie des irritants", "Atelier", ["2", "0", "2", "0", "2"]),
];

const sectionStyle = { display: "flex", flexDirection: "column", gap: 20 } as const;
const headStyle = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 20px" } as const;
const barStyle = { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px 20px" } as const;

function State({ title, initial, caption, save, note }: { title: string; initial: ReturnType<typeof row>[]; caption: string; save?: string; note?: string }) {
  const g = useGrid(initial);
  return (
    <section style={sectionStyle}>
      <div style={save ? barStyle : headStyle}>
        <div style={headStyle}>
          <h2 className="h3">{title}</h2>
          <StatusBadge kind="timesheet" value="DRAFT" />
        </div>
        {save && <SaveIndicator state="saved" time={save} />}
      </div>
      <TimeGrid caption={caption} days={DAYS} expected={EXPECTED} rows={g.rows} step={STEP} onChange={g.onChange} onRemove={g.onRemove} />
      {note !== undefined && (
        <div style={barStyle}>
          <p className="small">{note || g.check.message}</p>
          <Button variant="primary" disabled={!g.check.canSubmit}>Soumettre la semaine</Button>
        </div>
      )}
    </section>
  );
}

export default function Page() {
  return (
    <Planche title="Grille de saisie hebdomadaire" lead="États en cours de saisie : vide, partiellement remplie, complète, et l'erreur de dépassement." gap={60} minHeight={2050}>
      <section style={sectionStyle}>
        <div style={headStyle}>
          <h2 className="h3">1. Vide</h2>
          <StatusBadge kind="timesheet" value="DRAFT" />
        </div>
        <TimeGrid caption="Grille de saisie sans ligne" days={DAYS} expected={EXPECTED} rows={[]} step={STEP} />
        <EmptyState
          title="Aucune ligne pour cette semaine"
          actions={
            <>
              <Button variant="primary" icon="plus">Ajouter une ligne</Button>
              <Button>Reprendre les lignes de la semaine 11</Button>
            </>
          }
        >
          Ajoutez un projet pour commencer, ou reprenez les lignes de la semaine précédente.
        </EmptyState>
      </section>
      <State title="2. Partiellement remplie" initial={PARTIAL} caption="Grille partiellement remplie" save="10:42" note="" />
      <State title="Erreur de saisie : plafond journalier dépassé" initial={OVER} caption="Grille avec un dépassement le mercredi" />
      <State title="3. Complète" initial={COMPLETE} caption="Grille complète, prête à être soumise" save="16:40" note="" />
    </Planche>
  );
}
