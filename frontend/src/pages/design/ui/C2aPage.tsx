import type { DayValue } from "@/entities/timesheet";
import { dict } from "@/shared/i18n";
import { EmptyState, SaveIndicator } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { DayEntry } from "@/widgets/day-entry";
import { CHOICES, DAYS, EXPECTED, SubmitBar, useDays } from "./day-demo";
import { Planche } from "./Planche";

// Planche C2-A, version 2 (docs/design-v2.md) : saisie par jour, un projet par journée.
// Remplace la grille projets × jours des captures C2 (conçue pour les heures).

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

function State({ title, initial, caption, save, future }: { title: string; initial: DayValue[]; caption: string; save?: string; future?: boolean[] }) {
  const days = useDays(initial);
  return (
    <section className="flex flex-col gap-20">
      <Heading title={title} save={save} />
      <DayEntry caption={caption} days={DAYS} expected={EXPECTED} choices={CHOICES} values={days.values} onChange={days.onChange} futureDays={future} />
      <SubmitBar summary={days.summary} />
    </section>
  );
}

export function C2aPage() {
  return (
    <Planche
      className="gap-60"
      title="Saisie par jour"
      lead="Version 2 de la grille : une journée va sur un seul projet, on la choisit dans une liste. Le dépassement n'est plus possible, la saisie se fait en cinq choix, la même au bureau et sur mobile."
    >
      <State title="1. En cours" caption="Saisie en cours, jeudi et vendredi à venir" initial={["souscription-tests", "nps-analyse", "irritants-atelier", null, null]} save="10:42" future={[false, false, false, false, true]} />
      <State title="2. Complète" caption="Saisie complète, prête à être soumise" initial={["souscription-tests", "souscription-atelier", "nps-analyse", "nps-analyse", "absence"]} save="16:40" />
      <section className="flex flex-col gap-20">
        <Heading title="3. Aucun projet ouvert" />
        <EmptyState title={dict.dayEntry.noChoiceTitle}>{dict.dayEntry.noChoiceText}</EmptyState>
      </section>
    </Planche>
  );
}
