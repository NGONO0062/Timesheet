import { describe, expect, it } from "vitest";
import type { IsoWeek } from "../iso-week";
import { daysByPhase, type PhaseProject } from "./phases";
import { buildReportView } from "./view";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Cartographie des irritants : Définir le 2 février, Mesurer le 23, Analyser le 16 mars.
const CARTO: PhaseProject = {
  projectId: "carto",
  code: "CX-2026-03",
  name: "Cartographie des irritants",
  changes: [
    { phase: "DEFINE", day: day("2026-02-02") },
    { phase: "MEASURE", day: day("2026-02-23") },
    { phase: "ANALYZE", day: day("2026-03-16") },
  ],
};

describe("jours par phase DMAIC", () => {
  it("range chaque jour dans la phase où était le projet ce jour-là", () => {
    const entries = [
      { projectId: "carto", date: day("2026-02-20"), hours: 1 },
      { projectId: "carto", date: day("2026-03-12"), hours: 1 },
      { projectId: "carto", date: day("2026-03-13"), hours: 1 },
      { projectId: "carto", date: day("2026-03-16"), hours: 1 },
      { projectId: "carto", date: day("2026-03-17"), hours: 0.0625 },
      // Projet standard : ignoré.
      { projectId: "refonte", date: day("2026-03-17"), hours: 1 },
    ];
    expect(daysByPhase(entries, [CARTO])).toEqual([
      { projectId: "carto", code: "CX-2026-03", name: "Cartographie des irritants", before: 0, byPhase: [1, 2, 1.06, 0, 0], total: 4.06 },
    ]);
  });

  it("met à part les jours saisis avant que le projet devienne DMAIC", () => {
    const rows = daysByPhase([{ projectId: "carto", date: day("2026-01-27"), hours: 1 }], [CARTO]);
    expect(rows[0]).toMatchObject({ before: 1, byPhase: [0, 0, 0, 0, 0], total: 1 });
  });

  it("n'affiche pas un projet DMAIC sans jour saisi", () => {
    expect(daysByPhase([], [CARTO])).toEqual([]);
  });
});

describe("tableau du reporting", () => {
  const W11: IsoWeek = { year: 2026, week: 11 };
  const W12: IsoWeek = { year: 2026, week: 12 };
  const entry = (date: string, week: IsoWeek, personId = "aicha") => ({
    week,
    date: day(date),
    personId,
    projectId: "carto",
    projectCode: "CX-2026-03",
    projectName: "Cartographie des irritants",
    activityName: "Atelier",
    hours: 1,
  });
  const base = {
    params: { axis: "project" as const, from: W11, to: W12, personId: null },
    current: W12,
    people: [{ id: "aicha", name: "Aïcha Ndongo", team: null }, { id: "kevin", name: "Kevin Fotso", team: null }],
    entries: [entry("2026-03-12", W11), entry("2026-03-16", W12), entry("2026-03-17", W12, "kevin")],
    states: [],
    members: new Map([["carto", 5]]),
    weekCapacity: [5, 5],
    now: day("2026-03-19"),
  };

  it("écrit les cinq phases, le total, et le pied de tableau", () => {
    const view = buildReportView({ ...base, phaseProjects: [CARTO] });
    expect(view.phases?.head).toEqual(["Définir", "Mesurer", "Analyser", "Améliorer", "Contrôler"]);
    expect(view.phases?.rows[0]).toMatchObject({ label: "Cartographie des irritants", sub: "CX-2026-03", raw: { cells: [0, 1, 2, 0, 0], total: 3 } });
    expect(view.phases?.foot.raw).toEqual({ cells: [0, 1, 2, 0, 0], total: 3 });
  });

  it("suit le périmètre de l'écran : une personne choisie, ses jours seulement", () => {
    const view = buildReportView({ ...base, params: { ...base.params, personId: "kevin" }, phaseProjects: [CARTO] });
    expect(view.phases?.rows[0]?.raw).toEqual({ cells: [0, 0, 1, 0, 0], total: 1 });
  });

  it("n'a pas de tableau sans projet DMAIC", () => {
    expect(buildReportView(base).phases).toBeNull();
  });
});
