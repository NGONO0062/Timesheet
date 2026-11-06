import { useState } from "react";
import type { IsoWeek } from "@/shared/lib/iso-week";
import { cx } from "@/shared/lib/cx";
import { Icon } from "@/shared/ui/Icon";
import { WeekSelector, type RecentWeek } from "@/widgets/week-selector";
import { Exemple, Planche } from "./Planche";

// Planche C1-Selecteur-semaine. Semaine de référence : 12 de 2026.
const W12: IsoWeek = { year: 2026, week: 12 };
const RECENT: RecentWeek[] = [
  { week: { year: 2026, week: 12 }, status: "DRAFT" },
  { week: { year: 2026, week: 11 }, status: "MISSING" },
  { week: { year: 2026, week: 10 }, status: "VALIDATED" },
  { week: { year: 2026, week: 9 }, status: "VALIDATED" },
];

function Live({ initial, current = W12, allowFutureWeeks = true, large, staticOpen }: {
  initial: IsoWeek;
  current?: IsoWeek;
  allowFutureWeeks?: boolean;
  large?: boolean;
  staticOpen?: boolean;
}) {
  const [week, setWeek] = useState(initial);
  return (
    <WeekSelector
      week={week}
      current={current}
      onNavigate={setWeek}
      allowFutureWeeks={allowFutureWeeks}
      recent={RECENT}
      olderHref="#"
      large={large}
      staticOpen={staticOpen}
    />
  );
}

const ARROW = "inline-flex size-control items-center justify-center rounded-md border-2";

/** États figés de la flèche : la planche les montre côte à côte. */
const STATES = [
  ["Survol", "border-black bg-black text-white", false],
  ["Actif", "border-active bg-active text-black", false],
  ["Focus", "border-black bg-white text-black focus-ring", false],
  ["Désactivé", "border-gray-999 bg-gray-999 text-white", true],
] as const;

export function C1Page() {
  return (
    <Planche title="Sélecteur de semaine" lead="Trois boutons accolés et un raccourci. Hauteur 40 px (50 px sur mobile), bordure 2 px, rayon 6 px, libellé 16 px gras.">
      <div className="grid grid-cols-2 items-start gap-x-20 gap-y-30">
        <Exemple title="Semaine courante" note="Sur la semaine courante, le raccourci est remplacé par un badge : aucun bouton désactivé à l'écran.">
          <Live initial={W12} />
        </Exemple>
        <Exemple title="Autre semaine : le raccourci apparaît" note="Le changement de semaine est annoncé aux lecteurs d'écran par une zone de statut.">
          <Live initial={{ year: 2026, week: 11 }} />
        </Exemple>
        <Exemple title="Semaine à cheval sur deux mois" note="Le libellé central a une largeur minimale de 320 px pour que les flèches ne bougent pas d'une semaine à l'autre.">
          <Live initial={{ year: 2026, week: 40 }} current={{ year: 2026, week: 41 }} />
        </Exemple>
        <Exemple title="Saisie future interdite par la division" note="Flèche suivante désactivée : fond gris plein, icône blanche, sans transparence.">
          <Live initial={W12} allowFutureWeeks={false} />
        </Exemple>
        <Exemple title="États : survol, actif, focus" note="Survol par inversion de contraste, appui en orange de marque (le temps du clic), focus en double anneau noir et blanc. Dans la liste ouverte, la semaine courante est marquée par un trait orange et une coche, sans aplat.">
          <div className="flex flex-wrap items-start gap-20">
            {STATES.map(([label, look, disabled]) => (
              <div key={label} className="flex flex-col items-start gap-10">
                <button className={cx(ARROW, look)} type="button" disabled={disabled} aria-label={`Semaine précédente, état ${label.toLowerCase()}`}>
                  <Icon name="left" />
                </button>
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </Exemple>
        <Exemple title="Mobile 375 : contrôles de 50 px" note="Sur deux lignes dans le conteneur de 312 px. Le raccourci passe dans la liste ouverte.">
          <div className="w-full max-w-mobile">
            <Live initial={W12} large />
          </div>
        </Exemple>
        <Exemple wide title="Liste des semaines ouverte" note="Le libellé ouvre la liste des semaines récentes avec leur statut. La liste réutilise le Dropdown ODS.">
          <div className="min-h-open-list">
            <Live initial={W12} staticOpen />
          </div>
        </Exemple>
      </div>
    </Planche>
  );
}
