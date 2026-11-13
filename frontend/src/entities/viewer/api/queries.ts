// Utilisateur connecté (TanStack Query). Sans session : null, pas une erreur.
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/shared/api/http";
import type { Viewer } from "../model/types";

export const VIEWER_KEY = ["viewer"] as const;

export async function fetchViewer(): Promise<Viewer | null> {
  try {
    return await api<Viewer>("/auth/moi");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function useViewer() {
  return useQuery({ queryKey: VIEWER_KEY, queryFn: fetchViewer, staleTime: 60_000 });
}
