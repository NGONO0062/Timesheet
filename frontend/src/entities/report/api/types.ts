// Réponse de l'API de reporting (ReportingController), telle que reçue.
export type Axis = "project" | "person" | "activity";
export const AXES: Axis[] = ["project", "person", "activity"];

export type ReportWeek = { year: number; week: number; monday: string; capacity: number; open: boolean };

export type Report = {
  current: { year: number; week: number };
  axis: Axis;
  from: { year: number; week: number };
  to: { year: number; week: number };
  personId: string | null;
  whole: boolean;
  people: Array<{ id: string; name: string; team: string | null }>;
  weeks: ReportWeek[];
  kpis: {
    entered: number;
    capacity: number;
    persons: number;
    weeks: number;
    missingDays: number;
    missingSheets: number;
    validated: number;
    pending: number;
    expectedSheets: number;
  };
  /** Couleurs de séries : index 0 à 3, dans l'ordre fixe des couleurs de graphiques. */
  series: Array<{ key: string; label: string; index: number; keys: string[] }>;
  entities: Array<{ key: string; label: string; sub: string; count: number; byWeek: number[]; total: number; series: number }>;
};

export type ReportFilters = { axis: Axis; from: string | null; to: string | null; personId: string | null };
