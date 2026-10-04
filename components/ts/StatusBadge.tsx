"use client";
// Étiquettes de statut (planche C4). Composant unique : aucun autre libellé de statut.
import { Dropdown } from "@/components/ods/Dropdown";
import { Icon } from "@/components/ods/Icon";
import { cx } from "@/lib/cx";
import { dict, t } from "@/lib/i18n";
import { PROJECT_STATUS_ORDER, statusLook, type ProjectStatus, type StatusKind, type StatusValue } from "@/lib/status";

type Props<K extends StatusKind> = { kind: K; value: StatusValue[K]; className?: string };

export function StatusBadge<K extends StatusKind>({ kind, value, className }: Props<K>) {
  const look = statusLook(kind, value);
  return <span className={cx("badge", look.className, className)}>{look.label}</span>;
}

/**
 * Étiquette de projet modifiable : pour qui a la permission « Gérer les projets »,
 * l'étiquette est le bouton qui ouvre les quatre statuts, l'actuel coché.
 * Le changement est immédiat (l'écran affiche le message avec « Annuler »).
 */
export function ProjectStatusButton({ projectName, value, onChange, defaultOpen }: {
  projectName: string;
  value: ProjectStatus;
  onChange: (next: ProjectStatus) => void;
  defaultOpen?: boolean;
}) {
  const look = statusLook("project", value);
  const order: ProjectStatus[] = [value, ...PROJECT_STATUS_ORDER.filter((s) => s !== value)];
  return (
    <Dropdown
      label={dict.status.changeStatus}
      defaultOpen={defaultOpen}
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
