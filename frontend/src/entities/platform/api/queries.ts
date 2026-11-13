// Accès à l'administration plateforme (TanStack Query) : divisions, onboarding, journal.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Matrix, Rules, Workflow } from "@/entities/admin";
import { api } from "@/shared/api/http";
import { auditQuery } from "../lib/filters";
import type { AuditFilters, AuditPage, DivisionDetail, DivisionRow, Identity, Onboarding, OnboardingAdmin } from "./types";

const PLATFORM_KEY = ["plateforme"] as const;

export function useDivisions() {
  return useQuery({ queryKey: [...PLATFORM_KEY, "divisions"], queryFn: () => api<DivisionRow[]>("/plateforme/divisions"), staleTime: 0 });
}

export function useDivision(id: string) {
  return useQuery({ queryKey: [...PLATFORM_KEY, "division", id], queryFn: () => api<DivisionDetail>(`/plateforme/divisions/${id}`), staleTime: 0, retry: false });
}

export function useOnboarding(id: string | null) {
  return useQuery({
    queryKey: [...PLATFORM_KEY, "onboarding", id],
    queryFn: () => api<Onboarding>(`/plateforme/onboarding/${id ?? ""}`),
    enabled: id !== null,
    staleTime: 0,
    retry: false,
  });
}

export function useAudit(f: AuditFilters) {
  const qs = auditQuery(f, true).toString();
  return useQuery({
    queryKey: [...PLATFORM_KEY, "journal", qs],
    queryFn: () => api<AuditPage>(`/plateforme/journal${qs ? `?${qs}` : ""}`),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

/** Lien de téléchargement d'un export du journal, avec les filtres de l'écran. */
export const auditExportHref = (f: AuditFilters, format: "csv" | "xlsx" | "pdf") => {
  const p = auditQuery(f);
  p.set("format", format);
  return `/api/v1/plateforme/journal/export?${p.toString()}`;
};

function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: PLATFORM_KEY });
}

export function useDivisionStatus(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (status: "ACTIVE" | "SUSPENDED") => api<{ name: string; previous: "ACTIVE" | "SUSPENDED" }>(`/plateforme/divisions/${id}/etat`, { method: "PUT", json: { status } }),
    onSuccess: refresh,
  });
}

type StepSaved = { id: string; step: number };

/** Étapes de l'onboarding : chacune enregistre sa saisie et renvoie l'étape atteinte. */
export function useOnboardingSteps(id: string | null) {
  const refresh = useRefresh();
  const options = { onSuccess: refresh };
  return {
    identity: useMutation({
      mutationFn: (input: Identity) => (id ? api<StepSaved>(`/plateforme/onboarding/${id}/identite`, { method: "PUT", json: input }) : api<StepSaved>("/plateforme/onboarding", { method: "POST", json: input })),
      ...options,
    }),
    admin: useMutation({ mutationFn: (input: OnboardingAdmin) => api<StepSaved>(`/plateforme/onboarding/${id ?? ""}/administrateur`, { method: "PUT", json: input }), ...options }),
    roles: useMutation({ mutationFn: (input: { matrix: Matrix; workflow: Workflow }) => api<StepSaved>(`/plateforme/onboarding/${id ?? ""}/roles`, { method: "PUT", json: input }), ...options }),
    rules: useMutation({ mutationFn: (input: Rules) => api<StepSaved>(`/plateforme/onboarding/${id ?? ""}/regles`, { method: "PUT", json: input }), ...options }),
    finish: useMutation({ mutationFn: () => api<{ name: string; email: string }>(`/plateforme/onboarding/${id ?? ""}/creation`, { method: "POST" }), ...options }),
  };
}
