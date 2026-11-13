// Accès à la vue consolidée (DivisionController) : trois blocs chargés séparément, pour qu'un
// bloc en panne n'empêche pas d'afficher les autres (§12), et les relances par e-mail.
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/http";
import type { IsoWeek } from "@/shared/lib/iso-week";

export type DivisionHead = { name: string; teams: number; people: number; week: IsoWeek; current: IsoWeek; threshold: number };

export type TeamRow = {
  id: string;
  name: string;
  manager: string | null;
  persons: number;
  entered: number;
  capacity: number;
  fill: number;
  submitted: number;
  validated: number;
  under: boolean;
};

export type WeekBlock = { rows: TeamRow[]; total: TeamRow; trend: Array<{ year: number; week: number; fill: number; open: boolean }> };

export type DriftKind = "BUDGET" | "UNDERFILL" | "LATE_VALIDATION" | "MISSING";

export type Drift = {
  kind: DriftKind;
  key: string;
  targetId: string;
  label: string;
  owner: string | null;
  year: number | null;
  week: number | null;
  consumed: number | null;
  budget: number | null;
  fill: number | null;
  threshold: number | null;
  count: number | null;
  days: number | null;
  missing: number | null;
};

const query = (w: IsoWeek | null) => (w ? `?annee=${w.year}&semaine=${w.week}` : "");

export function useDivisionHead(w: IsoWeek | null) {
  return useQuery({ queryKey: ["division", "tete", w?.year, w?.week], queryFn: () => api<DivisionHead>(`/division${query(w)}`), staleTime: 0 });
}

export function useWeekBlock(w: IsoWeek | null) {
  return useQuery({ queryKey: ["division", "semaine", w?.year, w?.week], queryFn: () => api<WeekBlock>(`/division/semaine${query(w)}`), staleTime: 0, retry: false });
}

export function useDrifts(w: IsoWeek | null) {
  return useQuery({ queryKey: ["division", "derives", w?.year, w?.week], queryFn: () => api<Drift[]>(`/division/derives${query(w)}`), staleTime: 0, retry: false });
}

/** Relance d'une dérive : le manager (validation en retard) ou la personne (saisie manquante). */
export function useRemind() {
  return useMutation({
    mutationFn: (target: { kind: "manager"; managerId: string } | { kind: "person"; personId: string; year: number; week: number }) =>
      api<{ name: string }>(
        target.kind === "manager" ? `/division/relances/manager/${target.managerId}` : `/division/relances/personne/${target.personId}/${target.year}/${target.week}`,
        { method: "POST" },
      ),
  });
}
