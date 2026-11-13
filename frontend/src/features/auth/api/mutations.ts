// Connexion, profils de démonstration et déconnexion. Après chaque changement de
// session, l'utilisateur connecté (VIEWER_KEY) est remplacé ou vidé dans le cache.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VIEWER_KEY, type Viewer } from "@/entities/viewer";
import { api, ApiError } from "@/shared/api/http";

/** « identifiants » ou « tentatives » : l'écran ne dit jamais lequel des deux champs est faux. */
export type SignInError = "identifiants" | "tentatives";

export function signInErrorOf(e: unknown): SignInError {
  const code = e instanceof ApiError && typeof e.body === "object" && e.body !== null ? (e.body as { error?: string }).error : undefined;
  return code === "tentatives" ? "tentatives" : "identifiants";
}

export function useSignIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => api<Viewer>("/auth/connexion", { method: "POST", json: input }),
    onSuccess: (viewer) => client.setQueryData(VIEWER_KEY, viewer),
  });
}

export function useDemoSignIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api<Viewer>("/auth/connexion-demo", { method: "POST", json: { email } }),
    onSuccess: (viewer) => client.setQueryData(VIEWER_KEY, viewer),
  });
}

/** Profils du bloc « Prototype uniquement » ; liste vide hors démonstration. */
export function useDemoProfiles() {
  return useQuery({ queryKey: ["demo-profiles"], queryFn: () => api<Array<{ label: string; email: string }>>("/auth/profils-demo"), staleTime: Infinity });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<null>("/auth/deconnexion", { method: "POST" }),
    // Quoi qu'il arrive, l'écran oublie l'utilisateur : la prochaine page le relira.
    onSettled: () => {
      client.clear();
      client.setQueryData(VIEWER_KEY, null);
    },
  });
}
