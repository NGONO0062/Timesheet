import { describe, expect, it } from "vitest";
import {
  DMAIC_PHASES, isDmaicPhase, nextPhase, phaseAfterKindChange, phaseChangedMessage, phaseLabel, phaseLine, phaseNumber, phaseStepText, previousPhase,
} from "./dmaic";
import { checkProjectInput } from "./rules";

describe("phases DMAIC", () => {
  it("suit l'ordre Définir, Mesurer, Analyser, Améliorer, Contrôler", () => {
    expect(DMAIC_PHASES.map(phaseLabel)).toEqual(["Définir", "Mesurer", "Analyser", "Améliorer", "Contrôler"]);
    expect(DMAIC_PHASES.map(phaseNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("donne la phase suivante et la précédente, sans dépasser les bornes", () => {
    expect(nextPhase("DEFINE")).toBe("MEASURE");
    expect(nextPhase("IMPROVE")).toBe("CONTROL");
    expect(nextPhase("CONTROL")).toBeNull();
    expect(previousPhase("MEASURE")).toBe("DEFINE");
    expect(previousPhase("DEFINE")).toBeNull();
  });

  it("reconnaît une phase valide", () => {
    expect(isDmaicPhase("ANALYZE")).toBe(true);
    expect(isDmaicPhase("analyze")).toBe(false);
    expect(isDmaicPhase(null)).toBe(false);
  });

  it("écrit la phase sous le code d'un projet DMAIC seulement", () => {
    expect(phaseLine("DMAIC", "ANALYZE")).toBe("DMAIC · Analyser (3 sur 5)");
    expect(phaseLine("STANDARD", null)).toBeNull();
    expect(phaseLine("DMAIC", null)).toBeNull();
    expect(phaseStepText("CONTROL")).toBe("Phase 5 sur 5 : Contrôler");
  });

  it("annonce le changement de phase", () => {
    expect(phaseChangedMessage("Cartographie des irritants", "IMPROVE")).toBe("« Cartographie des irritants » est passé à la phase « Améliorer ».");
  });
});

describe("type de projet", () => {
  it("fait commencer un nouveau projet DMAIC par « Définir »", () => {
    expect(phaseAfterKindChange(null, "DMAIC")).toEqual({ phase: "DEFINE", entered: "DEFINE" });
    expect(phaseAfterKindChange({ kind: "STANDARD", phase: null }, "DMAIC")).toEqual({ phase: "DEFINE", entered: "DEFINE" });
  });

  it("garde la phase d'un projet qui reste DMAIC, sans nouvelle entrée", () => {
    expect(phaseAfterKindChange({ kind: "DMAIC", phase: "ANALYZE" }, "DMAIC")).toEqual({ phase: "ANALYZE", entered: null });
  });

  it("retire la phase d'un projet standard", () => {
    expect(phaseAfterKindChange(null, "STANDARD")).toEqual({ phase: null, entered: null });
    expect(phaseAfterKindChange({ kind: "DMAIC", phase: "MEASURE" }, "STANDARD")).toEqual({ phase: null, entered: null });
  });

  it("vaut « Standard » quand le panneau ne le précise pas", () => {
    const base = { name: "Projet", start: "05/01/2026", end: "", status: "NOT_STARTED" as const, budget: "", activities: ["Analyse"], memberIds: [] };
    const plain = checkProjectInput(base);
    expect(plain.ok && plain.value.kind).toBe("STANDARD");
    const dmaic = checkProjectInput({ ...base, kind: "DMAIC" });
    expect(dmaic.ok && dmaic.value.kind).toBe("DMAIC");
  });
});
