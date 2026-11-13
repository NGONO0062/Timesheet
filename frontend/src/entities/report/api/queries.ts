// Accès au reporting : le rapport, et l'adresse des exports (mêmes filtres que l'écran).
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/http";
import type { Report, ReportFilters } from "./types";

/** Paramètres de l'adresse, communs à l'écran et aux exports. */
export function reportParams(f: ReportFilters): URLSearchParams {
  const q = new URLSearchParams();
  if (f.axis !== "project") q.set("axe", f.axis);
  if (f.from) q.set("de", f.from);
  if (f.to) q.set("a", f.to);
  if (f.personId) q.set("personne", f.personId);
  return q;
}

export function useReport(f: ReportFilters) {
  const q = reportParams(f).toString();
  return useQuery({ queryKey: ["reporting", q], queryFn: () => api<Report>(`/reporting${q ? `?${q}` : ""}`), placeholderData: keepPreviousData, staleTime: 0 });
}

/** Lien de téléchargement d'un export (l'API répond en pièce jointe). */
export function exportHref(f: ReportFilters, format: "csv" | "xlsx" | "pdf"): string {
  const q = reportParams(f);
  q.set("format", format);
  return `/api/v1/reporting/export?${q.toString()}`;
}
