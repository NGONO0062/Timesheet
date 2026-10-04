"use client";
import { useState } from "react";
import { Card } from "@/components/ods";
import { Icon } from "@/components/ods/Icon";
import { WeekSelector, type RecentWeek } from "@/components/ts/WeekSelector";
import type { IsoWeek } from "@/lib/iso-week";
import { Planche } from "../Planche";

// Planche C1-Selecteur-semaine. Semaine de référence : 12 de 2026.
const W12: IsoWeek = { year: 2026, week: 12 };
const RECENT: RecentWeek[] = [
  { week: { year: 2026, week: 12 }, status: "DRAFT" },
  { week: { year: 2026, week: 11 }, status: "MISSING" },
  { week: { year: 2026, week: 10 }, status: "VALIDATED" },
  { week: { year: 2026, week: 9 }, status: "VALIDATED" },
];

function Live({ initial, current = W12, allowFutureWeeks = true, large, defaultOpen }: {
  initial: IsoWeek; current?: IsoWeek; allowFutureWeeks?: boolean; large?: boolean; defaultOpen?: boolean;
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
      defaultOpen={defaultOpen}
    />
  );
}

export default function Page() {
  return (
    <Planche title="Sélecteur de semaine" lead="Trois boutons accolés et un raccourci. Hauteur 40 px (50 px sur mobile), bordure 2 px, rayon 6 px, libellé 16 px gras." minHeight={1420}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0px, 1fr))", gap: "30px 20px", alignItems: "start" }}>
        <Card>
          <h2 className="h5">Semaine courante</h2>
          <Live initial={W12} />
          <p className="small text-secondary">Sur la semaine courante, le raccourci est remplacé par un badge : aucun bouton désactivé à l&apos;écran.</p>
        </Card>
        <Card>
          <h2 className="h5">Autre semaine : le raccourci apparaît</h2>
          <Live initial={{ year: 2026, week: 11 }} />
          <p className="small text-secondary">Le changement de semaine est annoncé aux lecteurs d&apos;écran par une zone de statut.</p>
        </Card>
        <Card>
          <h2 className="h5">Semaine à cheval sur deux mois</h2>
          <Live initial={{ year: 2026, week: 40 }} current={{ year: 2026, week: 41 }} />
          <p className="small text-secondary">Le libellé central a une largeur minimale de 320 px pour que les flèches ne bougent pas d&apos;une semaine à l&apos;autre.</p>
        </Card>
        <Card>
          <h2 className="h5">Saisie future interdite par la division</h2>
          <Live initial={W12} allowFutureWeeks={false} />
          <p className="small text-secondary">Flèche suivante désactivée : fond #999999, icône blanche, sans transparence.</p>
        </Card>
        <Card>
          <h2 className="h5">États : survol, actif, focus</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
            {([
              ["Survol", "btn btn-icon", { background: "#000000", color: "#ffffff" }, false],
              ["Actif", "btn btn-icon active", undefined, false],
              ["Focus", "btn btn-icon is-focus", undefined, false],
              ["Désactivé", "btn btn-icon", undefined, true],
            ] as const).map(([label, cls, style, disabled]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                <button className={cls} type="button" disabled={disabled} aria-label={`Semaine précédente, état ${label.toLowerCase()}`} style={style}>
                  <Icon name="left" />
                </button>
                <span className="small">{label}</span>
              </div>
            ))}
          </div>
          <p className="small text-secondary">Survol par inversion de contraste, actif en orange de marque, focus en double anneau noir et blanc.</p>
        </Card>
        <Card>
          <h2 className="h5">Mobile 375 : contrôles de 50 px</h2>
          <div style={{ width: 312 }}>
            <Live initial={W12} large />
          </div>
          <p className="small text-secondary">Sur deux lignes dans le conteneur de 312 px. Le raccourci passe dans la liste ouverte.</p>
        </Card>
        <Card style={{ gridColumn: "1 / -1" }}>
          <h2 className="h5">Liste des semaines ouverte</h2>
          <div style={{ minHeight: 290 }}>
            <Live initial={W12} defaultOpen />
          </div>
          <p className="small text-secondary">Le libellé ouvre la liste des semaines récentes avec leur statut. La liste réutilise le Dropdown ODS.</p>
        </Card>
      </div>
    </Planche>
  );
}
