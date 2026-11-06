import { Button } from "@/shared/ui/Button";
import { EmptyState, SaveIndicator } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { TimeGrid, type GridRow } from "@/widgets/time-grid";
import { DAYS, EXPECTED, STEP, row, useGrid } from "./grid-demo";
import { Planche } from "./Planche";

// Planche C2-Grille-etats-A : vide, partielle, dépassement, complète.
const PARTIAL = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["1", "", "", "", ""]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["", "1", "", "", ""]),
  row("r3", "Cartographie des irritants", "Atelier", ["", "", "1", "", ""]),
];
const OVER = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["1", "1", "1", "", ""]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["", "", "1", "", ""]),
];
const COMPLETE = [
  row("r1", "Refonte parcours souscription", "Tests utilisateurs", ["1", "1", "", "", ""]),
  row("r2", "Baromètre NPS T1 2026", "Analyse", ["", "", "1", "1", ""]),
  row("r3", "Cartographie des irritants", "Atelier", ["", "", "", "", "1"]),
];

function Heading({ title, save }: { title: string; save?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
      <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
        <h2 className="text-h3">{title}</h2>
        <StatusBadge kind="timesheet" value="DRAFT" />
      </div>
      {save && <SaveIndicator state="saved" time={save} />}
    </div>
  );
}

function State({ title, initial, caption, save, note, focusCell }: { title: string; initial: GridRow[]; caption: string; save?: string; note?: string; focusCell?: string }) {
  const g = useGrid(initial);
  return (
    <section className="flex flex-col gap-20">
      <Heading title={title} save={save} />
      <TimeGrid caption={caption} days={DAYS} expected={EXPECTED} rows={g.rows} step={STEP} onChange={g.onChange} onRemove={g.onRemove} focusCell={focusCell} />
      {note !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
          <p className="text-sm">{note || g.check.message}</p>
          <Button variant="primary" disabled={!g.check.canSubmit}>
            Soumettre la semaine
          </Button>
        </div>
      )}
    </section>
  );
}

export function C2aPage() {
  return (
    <Planche className="gap-60" title="Grille de saisie hebdomadaire" lead="États en cours de saisie : vide, partiellement remplie, complète, et l'erreur de dépassement.">
      <section className="flex flex-col gap-20">
        <Heading title="1. Vide" />
        <TimeGrid caption="Grille de saisie sans ligne" days={DAYS} expected={EXPECTED} rows={[]} step={STEP} />
        <EmptyState
          title="Aucune ligne pour cette semaine"
          actions={
            <>
              <Button variant="primary" icon="plus">
                Ajouter une ligne
              </Button>
              <Button>Reprendre les lignes de la semaine 11</Button>
            </>
          }
        >
          Ajoutez un projet pour commencer, ou reprenez les lignes de la semaine précédente.
        </EmptyState>
      </section>
      <State
        title="2. Partiellement remplie"
        initial={PARTIAL}
        caption="Grille partiellement remplie"
        save="10:42"
        focusCell="0-2"
        note="Cellule Mer 18 en focus clavier. Tab passe à la cellule suivante, les flèches déplacent dans la grille."
      />
      <State title="Erreur de saisie : plafond journalier dépassé" initial={OVER} caption="Grille avec un dépassement le mercredi" />
      <State title="3. Complète" initial={COMPLETE} caption="Grille complète, prête à être soumise" save="16:40" note="Les cinq jours sont complets : le bouton Soumettre devient actif." />
    </Planche>
  );
}
