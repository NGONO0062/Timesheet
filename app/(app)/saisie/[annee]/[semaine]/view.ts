// Données de l'écran 3, préparées par le serveur et sérialisables pour le navigateur.
import type { RecentWeek } from "@/components/ts/WeekSelector";
import type { EligibleLine } from "@/lib/data/timesheets";
import type { IsoWeek } from "@/lib/iso-week";
import type { DisplayStatus } from "@/lib/timesheet/rules";

export type EntryLine = {
  projectId: string;
  activityId: string;
  project: string;
  activity: string;
  /** Projet sorti de « En cours » : visible en lecture seule. */
  locked: boolean;
  hours: Array<number | null>;
  flagged: boolean[];
};

export type EntryView = {
  week: IsoWeek;
  current: IsoWeek;
  allowFutureWeeks: boolean;
  /** Semaine future interdite par la division : pas de grille. */
  futureBlocked: boolean;
  recent: RecentWeek[];
  /** Jours ouvrés, en ISO (minuit UTC). */
  days: string[];
  expected: number[];
  futureDays: boolean[];
  todayIndex: number;
  step: number;
  hoursPerDay: number;
  status: DisplayStatus;
  editable: boolean;
  rejected: boolean;
  lines: EntryLine[];
  comment: string;
  eligible: EligibleLine[];
  previous: EligibleLine[];
  /** Semaine vide et préférence « reprendre les lignes » : la grille s'ouvre avec ces lignes. */
  autoCopy: boolean;
  previousWeek: number;
  validator: { name: string; role: string } | null;
  /** Texte de l'indicateur de sauvegarde au chargement. */
  savedTime: string | null;
  /** Bandeau d'information d'une fiche soumise ou validée. */
  info: { tone: "info" | "success"; text: string } | null;
  justSubmitted: boolean;
  rejection: { by: string; at: string; reason: string } | null;
  events: Array<{ id: string; label: string; by: string; at: string }>;
};
