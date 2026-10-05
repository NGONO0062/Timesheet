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

export type SaveState = "idle" | "saved" | "saving" | "failed" | "info";

/**
 * Zone de statut de la sauvegarde automatique. Toujours présente, même vide,
 * pour que les lecteurs d'écran annoncent le premier enregistrement.
 * `short` : libellé mobile (« Brouillon enregistré à 10:42 »).
 */
export function SaveIndicator({ state, time, short, message }: { state: SaveState; time?: string; short?: boolean; message?: string }) {
  return (
    <p className="ts-save" role="status">
      {state === "saved" && (
        <>
          <Mark tone="success" />
          {t(short ? dict.entry.savedShort : dict.grid.savedAt, { time: time ?? "" })}
        </>
      )}
      {state === "saving" && dict.grid.saving}
      {state === "failed" && (
        <>
          <Mark tone="danger" />
          {message ? `${dict.grid.saveFailed}. ${message}` : dict.grid.saveFailed}
        </>
      )}
      {state === "info" && message && (
        <>
          <Mark tone="info" />
          {message}
        </>
      )}
    </p>
  );
}
