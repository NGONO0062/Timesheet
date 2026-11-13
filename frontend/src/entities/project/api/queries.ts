// Accès aux projets (ProjectsController) : liste, panneau, statut, archivage.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/http";
import type { ProjectStatus } from "@/shared/lib/status";
import type { ProjectPayload } from "../lib/rules";

export type Project = {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  start: string;
  end: string | null;
  budget: number | null;
  consumed: number;
  archived: boolean;
  endDatePassed: boolean;
  memberIds: string[];
  activities: string[];
  manager: string | null;
};

export type ProjectList = { projects: Project[]; team: Array<{ id: string; name: string }> };

/** Fiche d'un projet : chiffres calculés par l'API à partir des fiches soumises ou validées. */
export type ProjectSheet = {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  start: string;
  end: string | null;
  archived: boolean;
  manager: string | null;
  budget: number | null;
  consumed: number;
  /** Journées soumises, pas encore validées (comprises dans `consumed`). */
  pending: number;
  /** Part du budget consommée, en pour cent ; null sans budget. */
  budgetPercent: number | null;
  /** Part du délai écoulée, de 0 à 100 ; null sans date de fin. */
  elapsedPercent: number | null;
  lastDay: string | null;
  attention: Array<"overBudget" | "endPassed" | "budgetAhead" | "quiet">;
  tasks: { backlog: number; todo: number; inProgress: number; review: number; done: number; total: number };
  /** `name` null : journées des autres équipes, regroupées. */
  people: Array<{ id: string | null; name: string | null; days: number; member: boolean }>;
  activities: Array<{ name: string; days: number }>;
  /** Les dernières semaines, de la plus ancienne à la semaine en cours. */
  weeks: Array<{ year: number; week: number; monday: string; days: number }>;
};

export const PROJECTS_KEY = ["projets"] as const;

export function useProjects() {
  return useQuery({ queryKey: PROJECTS_KEY, queryFn: () => api<ProjectList>("/projets"), staleTime: 0 });
}

/** Fiche d'un projet ; sous la clé des projets, donc relue après chaque écriture sur un projet. */
export function useProjectSheet(id: string) {
  return useQuery({ queryKey: [...PROJECTS_KEY, id], queryFn: () => api<ProjectSheet>(`/projets/${id}`), staleTime: 0, retry: false });
}

function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: PROJECTS_KEY });
}

/** Statut immédiat (affiché tout de suite, relu ensuite) ; la réponse donne l'ancien statut pour « Annuler ». */
export function useProjectStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: ProjectStatus }) => api<{ name: string; previous: ProjectStatus }>(`/projets/${input.id}/statut`, { method: "PUT", json: { status: input.status } }),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: PROJECTS_KEY });
      client.setQueryData<ProjectList>(PROJECTS_KEY, (old) => old && { ...old, projects: old.projects.map((p) => (p.id === input.id ? { ...p, status: input.status } : p)) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useSaveProject() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { id: string | null; body: ProjectPayload }) =>
      api<{ id: string; name: string; code: string }>(input.id ? `/projets/${input.id}` : "/projets", { method: input.id ? "PUT" : "POST", json: input.body }),
    onSuccess: refresh,
  });
}

export function useArchiveProject() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { id: string; archived: boolean }) => api<{ id: string; name: string }>(`/projets/${input.id}/archive`, { method: "PUT", json: { archived: input.archived } }),
    onSuccess: refresh,
  });
}
