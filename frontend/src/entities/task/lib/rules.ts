// Règles d'affichage du tableau Kanban (repris de lib/tasks/rules.ts). Pures et testées ;
// l'API applique les mêmes.
import { dict, t } from "@/shared/i18n";
import { statusLook, type TaskStatus } from "@/shared/lib/status";

export type TaskCard = { id: string; status: TaskStatus; position: number };

/** Position d'une carte posée en bas d'une colonne. */
export function bottomPosition(positions: number[]): number {
  return positions.length ? Math.max(...positions) + 1 : 0;
}

/** Cartes d'une colonne, de haut en bas. */
export function columnOf<T extends TaskCard>(tasks: T[], status: TaskStatus): T[] {
  return tasks.filter((x) => x.status === status).sort((a, b) => a.position - b.position);
}

/** Déplacement vu tout de suite : la carte passe en bas de la colonne choisie (ou à `position`). */
export function moveLocally<T extends TaskCard>(tasks: T[], id: string, status: TaskStatus, position?: number): T[] {
  const target = position ?? bottomPosition(tasks.filter((x) => x.status === status && x.id !== id).map((x) => x.position));
  return tasks.map((x) => (x.id === id ? { ...x, status, position: target } : x));
}

/** Nom accessible d'une colonne : « En cours, 2 tâches ». */
export function columnLabel(status: TaskStatus, n: number): string {
  return t(n > 1 ? dict.tasks.columnMany : dict.tasks.columnOne, { status: statusLook("task", status).label, n });
}

/** Message après un déplacement : « « Maquette » déplacée dans « En cours ». » */
export function movedMessage(title: string, status: TaskStatus): string {
  return t(dict.tasks.moved, { title, status: statusLook("task", status).label });
}

/** Message d'un titre refusé par l'API (« titleEmpty », « titleLong »). */
export function titleError(code: string): string {
  return code === "titleLong" ? t(dict.tasks.errors.titleLong, { max: 140 }) : dict.tasks.errors.titleEmpty;
}
