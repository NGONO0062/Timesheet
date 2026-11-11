// Accès à l'administration de division (TanStack Query) : réglages, utilisateurs, écritures.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VIEWER_KEY } from "@/entities/viewer";
import { api } from "@/shared/api/http";
import type { Admin, DivisionRole, Holiday, HolidayAdded, Holidays, Matrix, Rules, UserInput, UsersPage, Workflow } from "./types";

const ADMIN_KEY = ["administration"] as const;
const USERS_KEY = [...ADMIN_KEY, "utilisateurs"] as const;
const HOLIDAYS_KEY = [...ADMIN_KEY, "jours-feries"] as const;

export function useAdmin() {
  return useQuery({ queryKey: ADMIN_KEY, queryFn: () => api<Admin>("/administration"), staleTime: 0 });
}

export function useAdminUsers(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("recherche", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return useQuery({
    queryKey: [...USERS_KEY, query, page],
    queryFn: () => api<UsersPage>(`/administration/utilisateurs${qs ? `?${qs}` : ""}`),
    // Recherche et pagination gardent la liste à l'écran jusqu'à la réponse.
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

/** Après une écriture : la liste, les managers et l'utilisateur connecté (ses permissions) sont relus. */
function useRefresh() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: ADMIN_KEY });
    await client.invalidateQueries({ queryKey: VIEWER_KEY });
  };
}

export function useChangeRole() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { id: string; role: DivisionRole }) => api<{ name: string; previous: DivisionRole }>(`/administration/utilisateurs/${input.id}/role`, { method: "PUT", json: { role: input.role } }),
    onSuccess: refresh,
  });
}

export function useSetActive() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { id: string; active: boolean }) => api<{ name: string }>(`/administration/utilisateurs/${input.id}/compte`, { method: "PUT", json: { active: input.active } }),
    onSuccess: refresh,
  });
}

/** Invitation (`id` null) ou modification depuis la fenêtre. */
export function useSaveUser() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { id: string | null; user: UserInput }) =>
      api<{ name: string; email: string }>(input.id ? `/administration/utilisateurs/${input.id}` : "/administration/utilisateurs", { method: input.id ? "PUT" : "POST", json: input.user }),
    onSuccess: refresh,
  });
}

export function useResendInvitation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api<{ email: string }>(`/administration/utilisateurs/${id}/invitation`, { method: "POST" }),
    onSuccess: refresh,
  });
}

export function useSaveMatrix() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (matrix: Matrix) => api<null>("/administration/permissions", { method: "PUT", json: { matrix } }), onSuccess: refresh });
}

export function useSaveWorkflow() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (workflow: Workflow) => api<null>("/administration/workflow", { method: "PUT", json: workflow }), onSuccess: refresh });
}

export function useSaveRules() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (rules: Rules) => api<null>("/administration/regles", { method: "PUT", json: rules }), onSuccess: refresh });
}

export function useHolidays() {
  return useQuery({ queryKey: HOLIDAYS_KEY, queryFn: () => api<Holidays>("/administration/jours-feries"), staleTime: 0 });
}

/** Un jour férié change les jours à saisir : tout ce qui est en cache (saisie, tableau de bord, reporting) est à relire. */
function useRefreshAll() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}

/** `date` au format jj/mm/aaaa, comme saisie. */
export function useAddHoliday() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (input: { date: string; label: string }) => api<HolidayAdded>("/administration/jours-feries", { method: "POST", json: input }), onSuccess: refresh });
}

export function useRemoveHoliday() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (id: string) => api<Holiday>(`/administration/jours-feries/${id}`, { method: "DELETE" }), onSuccess: refresh });
}
