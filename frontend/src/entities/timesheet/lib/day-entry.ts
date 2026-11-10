// Saisie par jour (docs/design-v2.md). Depuis la saisie en jours entiers (point 82), une
// journée va sur un seul projet : on choisit un projet et une activité par jour, au lieu
// de remplir une grille projets × jours. Le dépassement devient impossible par construction.
import { dict, t } from "@/shared/i18n";
import type { DayStatus } from "@/shared/lib/status";
import { submitCheck, type SubmitCheck } from "./rules";

/** Projet et activité ouverts à la saisie pour la personne (membre d'un projet en cours, ou absence). */
export type DayChoice = { key: string; project: string; activity: string; /** Projet fermé depuis : lisible, plus choisissable. */ closed?: boolean };

/** Choix d'une journée : la clé d'un DayChoice, ou null (rien de saisi). */
export type DayValue = string | null;

export function choiceLabel(choice: DayChoice): string {
  return choice.closed ? `${choice.project} · ${t(dict.grid.entryClosed, { activity: choice.activity })}` : `${choice.project} · ${choice.activity}`;
}

/** Statut d'une journée : « À corriger » l'emporte, puis saisie faite, puis jour à venir ou à saisir. */
export function dayEntryStatus(input: { value: DayValue; isFuture?: boolean; flagged?: boolean }): DayStatus {
  if (input.flagged) return "TO_FIX";
  if (input.value) return "COMPLETE";
  return input.isFuture ? "UPCOMING" : "TODO";
}

export type DaySummary = { filled: number; expected: number; label: string; check: SubmitCheck };

/**
 * Bilan de la semaine : jours saisis sur jours ouvrés (un jour férié n'attend rien) et
 * raison écrite à côté du bouton Soumettre tant qu'il manque une journée.
 */
export function daySummary(days: Date[], expected: number[], values: DayValue[]): DaySummary {
  const totals = days.map((_, j) => ((expected[j] ?? 0) > 0 && values[j] ? 1 : 0));
  const filled = totals.reduce<number>((a, b) => a + b, 0);
  const due = expected.filter((e) => e > 0).length;
  return {
    filled,
    expected: due,
    label: t(dict.dayEntry.summary, { filled, expected: due }),
    check: submitCheck(days, totals, expected.map((e) => (e > 0 ? 1 : 0))),
  };
}
