// Étiquette d'une carte du tableau Kanban (PROMPT.md §9.12). Elle ouvre les cinq
// colonnes, l'actuelle cochée : c'est le déplacement au clavier et au doigt, à côté
// du glisser-déposer. Tableau en lecture seule : un simple StatusBadge.
import { cx } from "@/shared/lib/cx";
import { dict, t } from "@/shared/i18n";
import { statusLook, TASK_STATUS_ORDER, type TaskStatus } from "@/shared/lib/status";
import { Dropdown } from "@/shared/ui/Dropdown";
import { Icon } from "@/shared/ui/Icon";
import { BADGE, StatusBadge, StatusGlyph, TONE_CLASSES } from "@/shared/ui/StatusBadge";

const STATUS_BUTTON = "min-h-control-sm cursor-pointer hover:bg-black hover:text-white data-open:bg-black data-open:text-white";

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
      buttonLabel={t(dict.tasks.moveLabel, { title: taskTitle, status: look.label })}
      buttonClassName={cx(BADGE, TONE_CLASSES[look.tone], STATUS_BUTTON)}
      items={TASK_STATUS_ORDER.map((s) => ({
        key: s,
        content: <StatusBadge kind="task" value={s} />,
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
