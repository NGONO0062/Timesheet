// Tableau Kanban d'un projet (écran 15), tel que l'API le renvoie (/api/v1/kanban). Les
// écritures mettent la carte à jour tout de suite, puis relisent le tableau.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/http";
import type { ProjectStatus, TaskStatus } from "@/shared/lib/status";
import { moveLocally } from "../lib/rules";

export type BoardProject = { id: string; code: string; name: string; status: ProjectStatus; archived: boolean };

export type BoardTask = { id: string; title: string; status: TaskStatus; position: number; createdBy: string };

export type Board = { project: BoardProject; editable: boolean; readOnlyReason: "done" | "archived" | null; tasks: BoardTask[] };

const KANBAN_KEY = ["kanban"] as const;
const boardKey = (projectId: string) => [...KANBAN_KEY, "tableau", projectId] as const;

export function useBoardProjects() {
  return useQuery({ queryKey: [...KANBAN_KEY, "projets"], queryFn: () => api<BoardProject[]>("/kanban/projets"), staleTime: 0 });
}

export function useBoard(projectId: string | null) {
  return useQuery({
    queryKey: boardKey(projectId ?? ""),
    queryFn: () => api<Board>(`/kanban/projets/${projectId ?? ""}`),
    enabled: projectId !== null,
    staleTime: 0,
    retry: false,
  });
}

/** Écritures du tableau : changement local immédiat, puis relecture du tableau. */
export function useBoardActions(projectId: string) {
  const client = useQueryClient();
  const key = boardKey(projectId);
  const local = (change: (tasks: BoardTask[]) => BoardTask[]) => {
    void client.cancelQueries({ queryKey: key });
    client.setQueryData<Board>(key, (b) => (b ? { ...b, tasks: change(b.tasks) } : b));
  };
  const settle = () => client.invalidateQueries({ queryKey: key });

  return {
    create: useMutation({
      mutationFn: (title: string) => api<{ id: string; title: string }>(`/kanban/projets/${projectId}/taches`, { method: "POST", json: { title } }),
      onSettled: settle,
    }),
    move: useMutation({
      mutationFn: (input: { id: string; status: TaskStatus; position?: number }) =>
        api<{ title: string; previousStatus: TaskStatus; previousPosition: number }>(`/kanban/taches/${input.id}/colonne`, { method: "PUT", json: { status: input.status, position: input.position } }),
      onMutate: (input) => local((tasks) => moveLocally(tasks, input.id, input.status, input.position)),
      onSettled: settle,
    }),
    rename: useMutation({
      mutationFn: (input: { id: string; title: string }) => api<{ id: string; title: string }>(`/kanban/taches/${input.id}/titre`, { method: "PUT", json: { title: input.title } }),
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: (input: { id: string; deleted: boolean }) => api<{ id: string; title: string }>(`/kanban/taches/${input.id}/suppression`, { method: "PUT", json: { deleted: input.deleted } }),
      onMutate: (input) => {
        if (input.deleted) local((tasks) => tasks.filter((x) => x.id !== input.id));
      },
      onSettled: settle,
    }),
  };
}
