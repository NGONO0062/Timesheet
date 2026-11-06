import { useState } from "react";
import { ProjectStatusMenu, statusChangedMessage } from "@/entities/project";
import type { ProjectStatus, StatusKind, StatusValue } from "@/shared/lib/status";
import { Button } from "@/shared/ui/Button";
import { Alert, Card, Table } from "@/shared/ui/Display";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Planche } from "./Planche";

function StatusTable<K extends StatusKind>({ caption, kind, rows, extra }: {
  caption: string;
  kind: K;
  rows: ReadonlyArray<readonly [StatusValue[K], string, string?]>;
  extra?: string;
}) {
  return (
    <Table caption={caption} responsive={false}>
      <thead>
        <tr>
          <th scope="col" className="w-status-col">
            Étiquette
          </th>
          <th scope="col">Ce qu&apos;elle veut dire</th>
          {extra && <th scope="col">{extra}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(([value, meaning, more]) => (
          <tr key={value}>
            <td className="whitespace-nowrap">
              <StatusBadge kind={kind} value={value} />
            </td>
            <td>{meaning}</td>
            {extra && <td>{more}</td>}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// Planche C4-Etiquettes-statut.
export function C4Page() {
  const [status, setStatus] = useState<ProjectStatus>("IN_PROGRESS");
  const [previous, setPrevious] = useState<ProjectStatus | null>(null);

  return (
    <Planche
      title="Étiquettes de statut"
      lead="Un seul vocabulaire pour toute l'application. Chaque étiquette associe une forme et un libellé : la couleur ne porte jamais l'information seule."
    >
      <div className="grid grid-cols-2 items-start gap-20">
        <Card strong className="col-span-full">
          <h2 className="text-h5">Projet</h2>
          <StatusTable
            caption="Statuts d'un projet"
            kind="project"
            extra="Saisie des temps"
            rows={[
              ["NOT_STARTED", "Le projet est créé mais pas encore lancé.", "Fermée"],
              ["IN_PROGRESS", "Le projet est actif.", "Ouverte à ses membres"],
              ["ON_HOLD", "Le projet est suspendu et reprendra.", "Fermée, les jours déjà saisis sont conservés"],
              ["DONE", "Le projet est clos.", "Fermée, le projet reste dans le reporting"],
            ]}
          />
          <p className="text-sm text-gray-595">
            Le statut est changé par le manager, l&apos;owner ou l&apos;administrateur de division. Les autres rôles voient l&apos;étiquette sans pouvoir la modifier.
          </p>
        </Card>

        <Card>
          <h2 className="text-h5">Changer le statut d&apos;un projet</h2>
          <p>L&apos;étiquette est le bouton. Elle ouvre la liste des quatre statuts, le statut actuel est coché.</p>
          <div className="flex min-h-status-list flex-col items-start gap-5">
            <ProjectStatusMenu
              projectName="Refonte parcours souscription"
              value={status}
              canManage
              staticOpen
              onChange={(next) => {
                setPrevious(status);
                setStatus(next);
              }}
            />
          </div>
          <Alert
            tone="success"
            role="status"
            action={
              <Button
                variant="link"
                onClick={() => {
                  if (previous) setStatus(previous);
                  setPrevious(null);
                }}
              >
                Annuler
              </Button>
            }
          >
            <p>{previous ? statusChangedMessage("Refonte parcours souscription", status) : statusChangedMessage("Refonte FAQ en ligne", "IN_PROGRESS")}</p>
          </Alert>
          <p className="text-sm text-gray-595">Le changement est immédiat et réversible : pas de fenêtre de confirmation, un message avec « Annuler ».</p>
        </Card>

        <Card>
          <h2 className="text-h5">Jour de saisie</h2>
          <StatusTable
            caption="Statuts d'un jour dans la grille"
            kind="day"
            rows={[
              ["UPCOMING", "Jour futur, rien n'est attendu."],
              ["TODO", "Aucune heure saisie."],
              ["PARTIAL", "Moins que la journée attendue."],
              ["COMPLETE", "Exactement la journée attendue."],
              ["OVER", "Plus d’une journée, la soumission est bloquée."],
              ["TO_FIX", "Jour signalé par le manager lors d'un rejet."],
            ]}
          />
        </Card>

        <Card>
          <h2 className="text-h5">Fiche de temps (une semaine)</h2>
          <StatusTable
            caption="Statuts d'une fiche de temps"
            kind="timesheet"
            rows={[
              ["DRAFT", "Saisie en cours, la fiche est modifiable."],
              ["SUBMITTED", "Soumise au manager, en lecture seule."],
              ["REJECTED", "Renvoyée avec un motif, de nouveau modifiable."],
              ["VALIDATED", "Acceptée par le manager, verrouillée."],
              ["MISSING", "Échéance passée sans soumission."],
            ]}
          />
        </Card>

        <Card>
          <h2 className="text-h5">Fiche de présence RH (un mois)</h2>
          <StatusTable
            caption="Statuts d'une fiche de présence"
            kind="attendance"
            rows={[
              ["GENERATED", "Générée, la signature du stagiaire est attendue."],
              ["SIGNED_BY_INTERN", "Signée par le stagiaire."],
              ["SIGNED_BY_SUPERVISOR", "Signée par le superviseur, prête à partir."],
              ["SENT", "E-mail parti avec le PDF en pièce jointe."],
            ]}
          />
        </Card>

        <Card muted className="col-span-full">
          <h2 className="text-h5">Règles d&apos;usage</h2>
          <ul className="flex list-disc flex-col gap-10 pl-20">
            <li>Un objet, une étiquette : jamais deux étiquettes en concurrence sur la même ligne.</li>
            <li>Le même libellé partout : liste, détail, tableau de bord, e-mails, export.</li>
            <li>Une forme et un libellé pour chaque statut. La couleur vient en renfort, jamais seule.</li>
            <li>L&apos;étiquette de projet est un bouton pour qui peut la changer, un simple badge pour les autres.</li>
            <li>« Manquante » n&apos;est pas enregistré : le statut se calcule quand l&apos;échéance est passée sans soumission.</li>
          </ul>
        </Card>
      </div>
    </Planche>
  );
}
