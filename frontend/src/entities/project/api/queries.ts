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

export const PROJECTS_KEY = ["projets"] as const;

export function useProjects() {
  return useQuery({ queryKey: PROJECTS_KEY, queryFn: () => api<ProjectList>("/projets"), staleTime: 0 });
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
