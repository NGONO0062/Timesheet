// Accès aux fiches de présence (TanStack Query) : stagiaire et superviseur.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DASHBOARD_KEY } from "@/entities/timesheet";
import { api } from "@/shared/api/http";
import type { AttendanceMonth, AttendanceSheet, SignInput, SignResult, SupervisedList } from "./types";

const ATTENDANCE_KEY = ["fiches-presence"] as const;

export const attendanceHref = (year: number, month: number) => `/fiche-presence/${year}/${month}`;
export const supervisedHref = (id: string) => `/validation/presence/${id}`;
export const attendancePdfHref = (id: string) => `/api/v1/fiches-presence/${id}/pdf`;

export function useMyMonths() {
  return useQuery({ queryKey: [...ATTENDANCE_KEY, "mois"], queryFn: () => api<AttendanceMonth[]>("/fiches-presence"), staleTime: 0 });
}

export function useMySheet(year: number, month: number) {
  return useQuery({
    queryKey: [...ATTENDANCE_KEY, "moi", year, month],
    queryFn: () => api<AttendanceSheet>(`/fiches-presence/${year}/${month}`),
    staleTime: 0,
    retry: false,
  });
}

/** Fiches à contre-signer ; `enabled` : seulement pour qui valide une équipe. */
export function useSupervised(enabled = true) {
  return useQuery({ queryKey: [...ATTENDANCE_KEY, "a-signer"], queryFn: () => api<SupervisedList>("/fiches-presence/a-signer"), staleTime: 0, enabled });
}

export function useSupervisedSheet(id: string) {
  return useQuery({ queryKey: [...ATTENDANCE_KEY, "a-signer", id], queryFn: () => api<AttendanceSheet>(`/fiches-presence/a-signer/${id}`), staleTime: 0, retry: false });
}

/** Après une signature, un renvoi ou un envoi : les fiches et le tableau de bord sont relus. */
function useRefresh() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: ATTENDANCE_KEY });
    await client.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
}

/** Signature du stagiaire, ou contre-signature du superviseur (avec son observation). */
export function useSign(id: string, supervisor: boolean) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: SignInput) => api<SignResult>(supervisor ? `/fiches-presence/a-signer/${id}/signature` : `/fiches-presence/${id}/signature`, { method: "POST", json: input }),
    onSuccess: refresh,
  });
}

/** Renvoi au stagiaire, motif obligatoire ; renvoie le nom du stagiaire. */
export function useReject(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (reason: string) => api<{ name: string }>(`/fiches-presence/a-signer/${id}/renvoi`, { method: "POST", json: { reason } }),
    onSuccess: refresh,
  });
}

/** Envoi aux RH (envoi automatique désactivé, ou envoi précédent en échec). */
export function useSendToHr(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: () => api<{ to: string }>(`/fiches-presence/a-signer/${id}/envoi`, { method: "POST" }),
    onSuccess: refresh,
  });
}
