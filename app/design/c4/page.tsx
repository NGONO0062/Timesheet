"use client";
import { useState } from "react";
import { Alert, Card, Table } from "@/components/ods";
import { ProjectStatusMenu, StatusBadge } from "@/components/ts/StatusBadge";
import { statusChangedMessage } from "@/lib/projects/rules";
import { Planche } from "../Planche";
import type { ProjectStatus } from "@/lib/status";

// Planche C4-Etiquettes-statut.
export default function Page() {
  const [status, setStatus] = useState<ProjectStatus>("IN_PROGRESS");
  const [previous, setPrevious] = useState<ProjectStatus | null>(null);

  return (
    <Planche title="Étiquettes de statut" lead="Un seul vocabulaire pour toute l'application. Chaque étiquette associe une forme et un libellé : la couleur ne porte jamais l'information seule." minHeight={1840}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0px, 1fr))", gap: 20, alignItems: "start" }}>
        <Card strong style={{ gridColumn: "1 / -1" }}>
          <h2 className="h5">Projet</h2>
          <Table caption="Statuts d'un projet" responsive={false}>
            <thead>
              <tr>
                <th scope="col" style={{ width: 220 }}>Étiquette</th>
                <th scope="col">Ce qu&apos;elle veut dire</th>
                <th scope="col">Saisie des temps</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["NOT_STARTED", "Le projet est créé mais pas encore lancé.", "Fermée"],
                ["IN_PROGRESS", "Le projet est actif.", "Ouverte à ses membres"],
                ["ON_HOLD", "Le projet est suspendu et reprendra.", "Fermée, les heures déjà saisies sont conservées"],
                ["DONE", "Le projet est clos.", "Fermée, le projet reste dans le reporting"],
              ] as const).map(([v, meaning, entry]) => (
                <tr key={v}>
                  <td><StatusBadge kind="project" value={v} /></td>
                  <td>{meaning}</td>
                  <td>{entry}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="small text-secondary">Le statut est changé par le manager, l&apos;owner ou l&apos;administrateur de division. Les autres rôles voient l&apos;étiquette sans pouvoir la modifier.</p>
        </Card>

        <Card>
          <h2 className="h5">Changer le statut d&apos;un projet</h2>
          <p>L&apos;étiquette est le bouton. Elle ouvre la liste des quatre statuts, le statut actuel est coché.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start", minHeight: 222 }}>
            <ProjectStatusMenu
              projectName="Refonte parcours souscription"
              value={status}
              canManage
              defaultOpen
              onChange={(next) => {
                setPrevious(status);
                setStatus(next);
              }}
            />
          </div>
          {previous ? (
            <Alert
              tone="success"
              role="status"
              action={
                <button className="btn btn-link" type="button" onClick={() => { setStatus(previous); setPrevious(null); }}>
                  Annuler
                </button>
              }
            >
              <p>{statusChangedMessage("Refonte parcours souscription", status)}</p>
            </Alert>
          ) : (
            <Alert tone="success" role="status" action={<button className="btn btn-link" type="button">Annuler</button>}>
              <p>{statusChangedMessage("Refonte FAQ en ligne", "IN_PROGRESS")}</p>
            </Alert>
          )}
          <p className="small text-secondary">Le changement est immédiat et réversible : pas de fenêtre de confirmation, un message avec « Annuler ».</p>
        </Card>

        <Card>
          <h2 className="h5">Jour de saisie</h2>
          <Table caption="Statuts d'un jour dans la grille" responsive={false}>
            <thead><tr><th scope="col" style={{ width: 220 }}>Étiquette</th><th scope="col">Ce qu&apos;elle veut dire</th></tr></thead>
            <tbody>
              {([
                ["UPCOMING", "Jour futur, rien n'est attendu."],
                ["TODO", "Aucune heure saisie."],
                ["PARTIAL", "Moins que les heures attendues."],
                ["COMPLETE", "Exactement les heures attendues."],
                ["OVER", "Plus que les heures attendues, la soumission est bloquée."],
                ["TO_FIX", "Jour signalé par le manager lors d'un rejet."],
              ] as const).map(([v, meaning]) => (
                <tr key={v}><td style={{ whiteSpace: "nowrap" }}><StatusBadge kind="day" value={v} /></td><td>{meaning}</td></tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <h2 className="h5">Fiche de temps (une semaine)</h2>
          <Table caption="Statuts d'une fiche de temps" responsive={false}>
            <thead><tr><th scope="col" style={{ width: 220 }}>Étiquette</th><th scope="col">Ce qu&apos;elle veut dire</th></tr></thead>
            <tbody>
              {([
                ["DRAFT", "Saisie en cours, la fiche est modifiable."],
                ["SUBMITTED", "Soumise au manager, en lecture seule."],
                ["REJECTED", "Renvoyée avec un motif, de nouveau modifiable."],
                ["VALIDATED", "Acceptée par le manager, verrouillée."],
                ["MISSING", "Échéance passée sans soumission."],
              ] as const).map(([v, meaning]) => (
                <tr key={v}><td style={{ whiteSpace: "nowrap" }}><StatusBadge kind="timesheet" value={v} /></td><td>{meaning}</td></tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <h2 className="h5">Fiche de présence RH (un mois)</h2>
          <Table caption="Statuts d'une fiche de présence" responsive={false}>
            <thead><tr><th scope="col" style={{ width: 220 }}>Étiquette</th><th scope="col">Ce qu&apos;elle veut dire</th></tr></thead>
            <tbody>
              {([
                ["GENERATED", "Générée, la signature du stagiaire est attendue."],
                ["SIGNED_BY_INTERN", "Signée par le stagiaire."],
                ["SIGNED_BY_SUPERVISOR", "Signée par le superviseur, prête à partir."],
                ["SENT", "E-mail parti avec le PDF en pièce jointe."],
              ] as const).map(([v, meaning]) => (
                <tr key={v}><td style={{ whiteSpace: "nowrap" }}><StatusBadge kind="attendance" value={v} /></td><td>{meaning}</td></tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card muted style={{ gridColumn: "1 / -1" }}>
          <h2 className="h5">Règles d&apos;usage</h2>
          <ul style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 20, listStyle: "disc" }}>
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
