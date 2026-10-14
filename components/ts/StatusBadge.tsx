"use client";
// Étiquettes de statut (planche C4). Composant unique : aucun autre libellé de statut.
import { Dropdown } from "@/components/ods/Dropdown";
import { Icon } from "@/components/ods/Icon";
import { cx } from "@/lib/cx";
import { dict, t } from "@/lib/i18n";
import { PROJECT_STATUS_ORDER, statusLook, TASK_STATUS_ORDER, type ProjectStatus, type StatusKind, type StatusValue, type TaskStatus } from "@/lib/status";

type Props<K extends StatusKind> = { kind: K; value: StatusValue[K]; params?: Record<string, string | number>; className?: string };

export function StatusBadge<K extends StatusKind>({ kind, value, params, className }: Props<K>) {
  const look = statusLook(kind, value, params);
  return <span className={cx("badge", look.className, className)}>{look.label}</span>;
}

/**
 * Étiquette de projet (PROMPT.md §9.4). Pour qui a la permission « Gérer les
 * projets », l'étiquette est le bouton qui ouvre les quatre statuts, l'actuel
 * coché ; le menu est rendu hors du flux pour ne pas être coupé par un tableau
 * à défilement. Sans la permission, c'est un simple StatusBadge.
 * Le changement est immédiat : l'écran affiche le message avec « Annuler ».
 */
export function ProjectStatusMenu({ projectName, value, onChange, canManage, defaultOpen }: {
  projectName: string;
  value: ProjectStatus;
  onChange: (next: ProjectStatus) => void;
  /** Permission effective « Gérer les projets » (MANAGE_PROJECTS). */
  canManage: boolean;
  defaultOpen?: boolean;
}) {
  if (!canManage) return <StatusBadge kind="project" value={value} />;
  const look = statusLook("project", value);
  const order: ProjectStatus[] = [value, ...PROJECT_STATUS_ORDER.filter((s) => s !== value)];
  return (
    <Dropdown
      label={dict.status.changeStatus}
      defaultOpen={defaultOpen}
      floating
      items={order.map((s) => ({
        key: s,
        content: <StatusBadge kind="project" value={s} />,
        current: s === value,
        currentSuffix: dict.status.currentSuffix,
        onSelect: () => {
          if (s !== value) onChange(s);
        },
      }))}
      trigger={(p) => (
        <button
          className={cx("badge ts-st-btn", look.className)}
          type="button"
          aria-label={t(dict.status.statusOf, { name: projectName, status: look.label })}
          {...p}
        >
          {look.label}
          <Icon name="down" />
        </button>
      )}
    />
  );
}

/**
 * Étiquette d'une carte du tableau Kanban (PROMPT.md §9.12). Elle ouvre les cinq
 * colonnes, l'actuelle cochée : c'est le déplacement au clavier et au doigt, à côté
 * du glisser-déposer. Tableau en lecture seule : un simple StatusBadge.
 */
export function TaskStatusMenu({ taskTitle, value, onChange, canMove }: {
  taskTitle: string;
  value: TaskStatus;
  onChange: (next: TaskStatus) => void;
  canMove: boolean;
}) {
  if (!canMove) return <StatusBadge kind="task" value={value} />;
  const look = statusLook("task", value);
  return (
    <Dropdown
      label={dict.tasks.moveMenu}
      floating
      items={TASK_STATUS_ORDER.map((s) => ({
        key: s,
        content: <StatusBadge kind="task" value={s} />,
        current: s === value,
        currentSuffix: dict.status.currentSuffix,
        onSelect: () => {
          if (s !== value) onChange(s);
        },
      }))}
      trigger={(p) => (
        <button
          className={cx("badge ts-st-btn", look.className)}
          type="button"
          aria-label={t(dict.tasks.moveLabel, { title: taskTitle, status: look.label })}
          {...p}
        >
          {look.label}
          <Icon name="down" />
        </button>
      )}
    />
  );
}
