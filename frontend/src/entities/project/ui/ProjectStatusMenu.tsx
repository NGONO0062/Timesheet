// Étiquette de projet (PROMPT.md §9.4, planche C4). Pour qui a la permission « Gérer
// les projets », l'étiquette est le bouton qui ouvre les quatre statuts, l'actuel
// coché ; sans la permission, c'est un simple StatusBadge. Le changement est
// immédiat : l'écran affiche le message avec « Annuler ».
import { cx } from "@/shared/lib/cx";
import { dict, t } from "@/shared/i18n";
import { PROJECT_STATUS_ORDER, statusLook, type ProjectStatus } from "@/shared/lib/status";
import { Dropdown } from "@/shared/ui/Dropdown";
import { Icon } from "@/shared/ui/Icon";
import { BADGE, StatusBadge, StatusGlyph, TONE_CLASSES } from "@/shared/ui/StatusBadge";

/** Étiquette-bouton : survol et ouverture en noir (inversion de contraste). */
export const STATUS_BUTTON = "min-h-control-sm cursor-pointer hover:bg-black hover:text-white data-open:bg-black data-open:text-white";

export function ProjectStatusMenu({ projectName, value, onChange, canManage, staticOpen }: {
  projectName: string;
  value: ProjectStatus;
  onChange: (next: ProjectStatus) => void;
  /** Permission effective « Gérer les projets » (MANAGE_PROJECTS). */
  canManage: boolean;
  /** Liste affichée : planches de /design seulement. */
  staticOpen?: boolean;
}) {
  if (!canManage) return <StatusBadge kind="project" value={value} />;
  const look = statusLook("project", value);
  const order: ProjectStatus[] = [value, ...PROJECT_STATUS_ORDER.filter((s) => s !== value)];
  return (
    <Dropdown
      label={dict.status.changeStatus}
      staticOpen={staticOpen}
      buttonLabel={t(dict.status.statusOf, { name: projectName, status: look.label })}
      buttonClassName={cx(BADGE, staticOpen ? "bg-black text-white" : TONE_CLASSES[look.tone], STATUS_BUTTON)}
      items={order.map((s) => ({
        key: s,
        content: <StatusBadge kind="project" value={s} />,
        current: s === value,
        currentSuffix: dict.status.currentSuffix,
        onSelect: () => {
          if (s !== value) onChange(s);
        },
      }))}
    >
      <StatusGlyph glyph={look.glyph} />
      {look.label}
      <Icon name="down" size="glyph" />
    </Dropdown>
  );
}
