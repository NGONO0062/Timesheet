// États d'un écran de données (PROMPT.md §12) et indicateur de sauvegarde.
import type { ReactNode } from "react";
import { Mark } from "@/components/ods/Icon";
import { dict, t } from "@/lib/i18n";

/** État vide : il explique pourquoi et propose l'action suivante. */
export function EmptyState({ title, children, actions, headingLevel = 3 }: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="ts-empty">
      <H className="h4">{title}</H>
      <p>{children}</p>
      {actions && <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>{actions}</div>}
    </div>
  );
}

/** Zone de statut de la sauvegarde automatique. */
export function SaveIndicator({ state, time }: { state: "saved" | "saving" | "failed"; time?: string }) {
  return (
    <p className="ts-save" role="status">
      {state === "saved" && (
        <>
          <Mark tone="success" />
          {t(dict.grid.savedAt, { time: time ?? "" })}
        </>
      )}
      {state === "saving" && dict.grid.saving}
      {state === "failed" && (
        <>
          <Mark tone="danger" />
          {dict.grid.saveFailed}
        </>
      )}
    </p>
  );
}
