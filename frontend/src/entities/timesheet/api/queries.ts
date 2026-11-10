// Accès à la saisie (TanStack Query) : semaine, brouillon, soumission, tableau de bord.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/shared/api/http";
import type { Dashboard, SaveResult, Week, WeekRef } from "./types";

export const weekKey = (w: WeekRef) => ["week", w.year, w.week] as const;
export const DASHBOARD_KEY = ["dashboard"] as const;

export function useWeek(w: WeekRef) {
  return useQuery({ queryKey: weekKey(w), queryFn: () => api<Week>(`/saisie/${w.year}/${w.week}`), staleTime: 0 });
}

export function useCurrentWeek() {
  return useQuery({ queryKey: ["week", "current"], queryFn: () => api<WeekRef>("/saisie/courante") });
}

export function useDashboard() {
  return useQuery({ queryKey: DASHBOARD_KEY, queryFn: () => api<Dashboard>("/tableau-de-bord"), staleTime: 0 });
}

export type WeekInput = { days: Array<{ date: string; key: string | null }>; comment: string };

/** Code d'une règle refusée par l'API (422) : « incomplete », « notEditable »… ; « session » si 401. */
export function ruleCodeOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "session";
    const body = e.body as { code?: string } | null;
    if (body?.code) return body.code;
  }
  return "unknown";
}

/** Sauvegarde automatique du brouillon : la semaine affichée n'est pas rechargée (la saisie reste à l'écran). */
export function useSaveDraft(w: WeekRef) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: WeekInput) => api<SaveResult>(`/saisie/${w.year}/${w.week}`, { method: "PUT", json: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  });
}

export function useSubmitWeek(w: WeekRef) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: WeekInput) => api<SaveResult>(`/saisie/${w.year}/${w.week}/soumission`, { method: "POST", json: input }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: weekKey(w) });
      await client.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}
