import "server-only";
// Chargement du rapport, commun à la page et aux exports : mêmes filtres, mêmes chiffres.
import { now } from "@/lib/clock";
import { getReportData, listReportPeople } from "@/lib/data/reporting";
import { currentWeek } from "@/lib/data/timesheets";
import { scopeOf } from "@/lib/data/viewer";
import { buildReportView, parseReportParams, weeksBetween } from "@/lib/reporting/view";
import type { Viewer } from "@/lib/viewer";

export async function loadReport(viewer: Viewer, sp: { axe?: string; de?: string; a?: string; personne?: string }) {
  const scope = scopeOf(viewer);
  const at = now();
  const current = currentWeek(at);
  const people = await listReportPeople(scope);
  const parsed = parseReportParams(sp, current);
  // Une personne hors du périmètre est ignorée : jamais de donnée hors portée.
  const params = { ...parsed, personId: people.some((p) => p.id === parsed.personId) ? parsed.personId : null };
  const data = await getReportData(scope, people, weeksBetween(params.from, params.to));
  const view = buildReportView({ params, current, people, ...data, now: at });
  const person = people.find((p) => p.id === params.personId) ?? null;
  return { at, current, people, params, view, person, whole: viewer.role === "OWNER" || viewer.role === "DIVISION_ADMIN" };
}
