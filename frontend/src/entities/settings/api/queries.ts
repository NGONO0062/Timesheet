// Paramètres de l'utilisateur connecté (écran 14) et pages publiques (mot de passe oublié,
// liens d'invitation et de réinitialisation), tels que l'API les renvoie.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VIEWER_KEY } from "@/entities/viewer";
import { api } from "@/shared/api/http";

export type NotificationKind = "fillReminder" | "validated" | "rejected" | "signatureReminder";

export type Settings = {
  name: string;
  email: string;
  role: string;
  division: string | null;
  manager: string | null;
  internship: { kind: "ACADEMIC" | "PROFESSIONAL" | "GRADUATE"; direction: string; department: string; service: string; start: string; end: string } | null;
  adminEmails: string[];
  usualArrival: string;
  usualDeparture: string;
  /** Notifications utiles au rôle seulement. */
  notifications: Array<{ kind: NotificationKind; enabled: boolean }>;
  locale: "fr" | "en";
  defaultSignatureMode: "DRAWN" | "PASSWORD";
};

const SETTINGS_KEY = ["parametres"] as const;

export function useSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => api<Settings>("/parametres"), staleTime: 0 });
}

export function useSaveHours() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { arrival: string; departure: string }) => api<null>("/parametres/horaires", { method: "PUT", json: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

/** Renvoie l'ancienne valeur, pour « Annuler ». */
export function useToggleNotification() {
  return useMutation({
    mutationFn: (input: { kind: NotificationKind; enabled: boolean }) => api<{ previous: boolean }>(`/parametres/notifications/${input.kind}`, { method: "PUT", json: { enabled: input.enabled } }),
  });
}

export function useSavePreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { locale: "fr" | "en"; defaultSignatureMode: "DRAWN" | "PASSWORD" }) => api<null>("/parametres/preferences", { method: "PUT", json: input }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SETTINGS_KEY });
      // La zone de signature propose d'abord le mode choisi.
      await client.invalidateQueries({ queryKey: VIEWER_KEY });
    },
  });
}

/** Le changement ferme toutes les sessions du compte, celle-ci comprise. */
export function useChangePassword() {
  return useMutation({ mutationFn: (input: { current: string; next: string; confirm: string }) => api<null>("/parametres/mot-de-passe", { method: "POST", json: input }) });
}

// ---------------------------------------------------------------------------
// Pages publiques (PROMPT.md §19)
// ---------------------------------------------------------------------------

export type LinkKind = "invitation" | "reinitialisation";

export function useRequestReset() {
  return useMutation({ mutationFn: (email: string) => api<null>("/compte/mot-de-passe-oublie", { method: "POST", json: { email } }) });
}

/** Compte du lien, s'il est encore valable (404 sinon). */
export function useLinkAccount(kind: LinkKind, token: string) {
  return useQuery({
    queryKey: ["compte", kind, token],
    queryFn: () => api<{ firstName: string; email: string }>(`/compte/liens/${kind}/${encodeURIComponent(token)}`),
    retry: false,
    staleTime: Infinity,
  });
}

export function useSetPasswordFromLink(kind: LinkKind, token: string) {
  return useMutation({
    mutationFn: (input: { next: string; confirm: string }) => api<null>(`/compte/liens/${kind}/${encodeURIComponent(token)}`, { method: "POST", json: input }),
  });
}
