// Accès à la validation (TanStack Query) : file, détail, décisions.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DASHBOARD_KEY } from "@/entities/timesheet";
import { api } from "@/shared/api/http";
import type { DecisionResult, Queue, QueueFilters, Review } from "./types";

const VALIDATION_KEY = ["validation"] as const;

export function useQueue(f: QueueFilters) {
  const params = new URLSearchParams({ periode: f.period, statut: f.tab });
  if (f.personId) params.set("personne", f.personId);
  return useQuery({
    queryKey: [...VALIDATION_KEY, "file", f.personId, f.period, f.tab],
    queryFn: () => api<Queue>(`/validation?${params.toString()}`),
    // Changer de filtre garde la file à l'écran jusqu'à la réponse (pas de saut de page).
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

export function useReview(id: string) {
  return useQuery({ queryKey: [...VALIDATION_KEY, "fiche", id], queryFn: () => api<Review>(`/validation/${id}`), staleTime: 0, retry: false });
}

/** Après une décision : la file, les fiches et le tableau de bord sont relus. */
function useRefresh() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: VALIDATION_KEY });
    await client.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

/** Décision groupée depuis la file : validation directe, rejet avec un motif commun. */
export function useGroupDecision() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { ids: string[]; decision: "VALIDATE" | "REJECT"; reason?: string }) => api<DecisionResult>("/validation/decisions", { method: "POST", json: input }),
    onSuccess: refresh,
  });
}

/** Décision depuis le détail : le rejet peut signaler des journées saisies. */
export function useDecision(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { decision: "VALIDATE" | "REJECT"; reason?: string; flagged?: string[] }) => api<DecisionResult>(`/validation/${id}/decision`, { method: "POST", json: input }),
    onSuccess: refresh,
  });
}
