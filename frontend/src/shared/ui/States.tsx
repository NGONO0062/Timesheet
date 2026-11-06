// États d'un écran de données (PROMPT.md §12) et indicateur de sauvegarde.
import type { ReactNode } from "react";
import { dict, t } from "@/shared/i18n";
import { Mark } from "./Display";

/** État vide : il explique pourquoi et propose l'action suivante. */
export function EmptyState({ title, children, actions, headingLevel = 3 }: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-col items-center gap-20 rounded-md border-2 border-dashed border-gray-999 bg-gray-fa px-20 py-60 text-center">
      <H className="text-h4">{title}</H>
      <p>{children}</p>
      {actions && <div className="flex flex-wrap justify-center gap-10">{actions}</div>}
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
    <p className="inline-flex items-center gap-10 text-sm text-black" role="status">
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
