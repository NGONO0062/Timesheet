import { describe, expect, it } from "vitest";
import { NBSP } from "@/shared/lib/format";
import type { Drift, TeamRow } from "../api/queries";
import { driftRow, fillText, kpiTexts, trendColumns } from "./view";

const row = (patch: Partial<TeamRow> = {}): TeamRow => ({ id: "t", name: "Parcours", manager: "Samuel Etoga", persons: 6, entered: 25, capacity: 30, fill: 83, submitted: 5, validated: 0, under: false, ...patch });
const drift = (patch: Partial<Drift>): Drift => ({
  kind: "BUDGET", key: "k", targetId: "p1", label: "Baromètre NPS T1 2026", owner: "Samuel Etoga",
  year: null, week: null, consumed: null, budget: null, fill: null, threshold: null, count: null, days: null, missing: null, ...patch,
});

describe("vue consolidée", () => {
  it("écrit le remplissage et les indicateurs comme la maquette", () => {
    expect(fillText(row())).toBe(`83${NBSP}% · 25 / 30${NBSP}jours`);
    expect(kpiTexts(row({ persons: 15, submitted: 13, validated: 4 }))).toMatchObject({
      submitted: "13 sur 15",
      submittedDetail: "2 fiches non soumises",
      validated: "4 sur 15",
      validatedDetail: "9 en attente chez les managers",
    });
    expect(kpiTexts(row({ submitted: 0, validated: 0 })).submittedDetail).toBe("Aucune fiche soumise cette semaine");
  });

  it("évide la colonne de la semaine en cours", () => {
    expect(trendColumns([{ year: 2026, week: 12, fill: 86, open: true }])).toEqual([
      { key: "2026-12", label: "S12", open: true, totalText: `86${NBSP}%`, height: 138, title: `Semaine 12, en cours : 86${NBSP}%` },
    ]);
  });

  it("donne à chaque dérive son texte et son action", () => {
    expect(driftRow(drift({ consumed: 99, budget: 50 }))).toMatchObject({
      tone: "danger",
      type: "Budget dépassé",
      gap: `99${NBSP}jours consommés pour 50${NBSP}jours prévus (+49${NBSP}jours)`,
      action: { kind: "link", href: "/projets?projet=p1", label: "Voir le projet" },
    });
    expect(driftRow(drift({ kind: "UNDERFILL", label: "Data CX", targetId: "t2", week: 12, fill: 75, threshold: 80 }))).toMatchObject({
      object: "Équipe Data CX · semaine 12",
      gap: `75${NBSP}% pour un seuil de 80${NBSP}%`,
      action: { href: "#equipe-t2" },
    });
    expect(driftRow(drift({ kind: "LATE_VALIDATION", label: "Data CX", count: 3, days: 3 }))).toMatchObject({ gap: "3 fiches en attente depuis plus de 3 jours", action: { kind: "remindManager" } });
    expect(driftRow(drift({ kind: "MISSING", label: "Aïcha Ndongo", week: 11, missing: 5 }))).toMatchObject({ object: "Aïcha Ndongo · semaine 11", tone: "warning", action: { kind: "remindPerson" } });
  });
});
