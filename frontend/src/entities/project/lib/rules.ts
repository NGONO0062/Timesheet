// Règles d'affichage des projets (reprises de lib/projects/rules.ts). Le serveur
// garde les règles qui décident ; celles-ci ne servent qu'aux messages de l'écran.
import { dict, t } from "@/shared/i18n";
import { statusLook, type ProjectStatus } from "@/shared/lib/status";

/** Seul un projet « En cours » ouvre la saisie des temps à ses membres. */
export function acceptsTimeEntry(status: ProjectStatus): boolean {
  return status === "IN_PROGRESS";
}

/** Message de statut après un changement : nouveau statut et effet sur la saisie. */
export function statusChangedMessage(name: string, status: ProjectStatus): string {
  return t(dict.project.statusChanged, {
    name,
    status: statusLook("project", status).label,
    effect: acceptsTimeEntry(status) ? dict.project.entryOpen : dict.project.entryClosed,
  });
}
