import { describe, expect, it } from "vitest";
import { DELIVERABLE_KEYS, DELIVERABLES, deliverableLabel, deliverableProgress, isDeliverableKey } from "./deliverables";
import { checkIndicator, indicatorForm, indicatorProgress, indicatorTexts, parseDecimal, type Indicator } from "./indicator";
import { canMoveDirectly, checkDecision, latestTollgate, phaseAfterApproval, requestRefusal, type TollgateRecord } from "./tollgate";

const at = (s: string) => new Date(`${s}T09:00:00Z`);

describe("livrables types", () => {
  it("trois par phase, quinze en tout, tous libellés", () => {
    expect(Object.values(DELIVERABLES).every((k) => k.length === 3)).toBe(true);
    expect(DELIVERABLE_KEYS).toHaveLength(15);
    expect(deliverableLabel("DEFINE_CHARTER")).toBe("Charte du projet");
    expect(DELIVERABLE_KEYS.every((k) => deliverableLabel(k).length > 0)).toBe(true);
  });

  it("refuse une clé hors du catalogue", () => {
    expect(isDeliverableKey("MEASURE_MSA")).toBe(true);
    expect(isDeliverableKey("MEASURE_X")).toBe(false);
    expect(isDeliverableKey(3)).toBe(false);
  });

  it("compte les livrables faits de la phase seulement", () => {
    expect(deliverableProgress("ANALYZE", new Set(["ANALYZE_CAUSES", "DEFINE_CHARTER"]))).toEqual({ done: 1, total: 3 });
  });
});

describe("indicateur du projet", () => {
  it("lit les nombres à la française", () => {
    expect(parseDecimal("12")).toBe(12);
    expect(parseDecimal("12,5")).toBe(12.5);
    expect(parseDecimal("1 200,25")).toBe(1200.25);
    expect(parseDecimal("−3")).toBe(-3);
    expect(parseDecimal("12.5")).toBe(12.5);
    expect(parseDecimal("1,234")).toBeNull();
    expect(parseDecimal("douze")).toBeNull();
    expect(parseDecimal("")).toBeNull();
  });

  it("tout vide retire l'indicateur", () => {
    expect(checkIndicator({ name: " ", unit: "", baseline: "", target: "", current: "" })).toEqual({ ok: true, value: null });
  });

  it("exige le nom, le départ et la cible, différente du départ", () => {
    const r = checkIndicator({ name: "", unit: "jours", baseline: "12", target: "12", current: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["current", "name", "target"]);
  });

  it("garde la valeur atteinte facultative", () => {
    expect(checkIndicator({ name: "Délai", unit: "jours", baseline: "12", target: "5", current: "" })).toEqual({
      ok: true,
      value: { name: "Délai", unit: "jours", baseline: 12, target: 5, current: null },
    });
  });

  const down: Indicator = { name: "Délai moyen", unit: "jours", baseline: 12, target: 5, current: 9 };

  it("mesure l'écart comblé dans les deux sens", () => {
    expect(indicatorProgress(down)?.ratio).toBeCloseTo(3 / 7);
    expect(indicatorProgress({ ...down, baseline: 60, target: 80, current: 70 })?.ratio).toBe(0.5);
    expect(indicatorProgress({ ...down, current: 4 })).toEqual({ ratio: 1, reached: true, wrongWay: false });
    expect(indicatorProgress({ ...down, current: 14 })).toEqual({ ratio: 0, reached: false, wrongWay: true });
    expect(indicatorProgress({ ...down, current: null })).toBeNull();
  });

  it("écrit l'objectif, les valeurs et l'avancée", () => {
    expect(indicatorTexts(down)).toEqual({
      goal: "Objectif : baisser de 12 jours à 5 jours.",
      facts: "Départ 12 jours · Cible 5 jours · Atteint 9 jours",
      progress: "43 % de l'écart comblé",
    });
    expect(indicatorTexts({ ...down, current: 5 }).progress).toBe("Cible atteinte");
    expect(indicatorTexts({ ...down, unit: null, current: null })).toEqual({
      goal: "Objectif : baisser de 12 à 5.",
      facts: "Départ 12 · Cible 5 · Pas encore mesuré",
      progress: null,
    });
  });

  it("remplit le formulaire avec la virgule", () => {
    expect(indicatorForm({ ...down, baseline: 12.5 })).toEqual({ name: "Délai moyen", unit: "jours", baseline: "12,5", target: "5", current: "9" });
    expect(indicatorForm(null).name).toBe("");
  });
});

describe("revue de passage", () => {
  const gates: TollgateRecord[] = [
    { phase: "DEFINE", status: "CHANGES_REQUESTED", requestedAt: at("2026-02-16") },
    { phase: "DEFINE", status: "APPROVED", requestedAt: at("2026-02-20") },
    { phase: "MEASURE", status: "REQUESTED", requestedAt: at("2026-03-13") },
  ];

  it("retient la dernière demande de chaque phase", () => {
    expect(latestTollgate(gates, "DEFINE")?.status).toBe("APPROVED");
    expect(latestTollgate(gates, "ANALYZE")).toBeNull();
  });

  it("sans sponsor, la phase se change directement", () => {
    expect(canMoveDirectly(false, [], "DEFINE", "MEASURE")).toBe(true);
  });

  it("avec un sponsor, n'avance que sur un passage accordé ; revient toujours en arrière", () => {
    expect(canMoveDirectly(true, gates, "DEFINE", "MEASURE")).toBe(true);
    expect(canMoveDirectly(true, gates, "MEASURE", "ANALYZE")).toBe(false);
    expect(canMoveDirectly(true, gates, "DEFINE", "ANALYZE")).toBe(false);
    expect(canMoveDirectly(true, gates, "ANALYZE", "DEFINE")).toBe(true);
    expect(canMoveDirectly(true, gates, "MEASURE", "MEASURE")).toBe(true);
  });

  it("ne demande une revue qu'avec un sponsor, et une seule à la fois", () => {
    expect(requestRefusal(false, [], "DEFINE")).toBe("noSponsor");
    expect(requestRefusal(true, gates, "MEASURE")).toBe("alreadyRequested");
    expect(requestRefusal(true, gates, "DEFINE")).toBe("alreadyApproved");
    expect(requestRefusal(true, gates, "ANALYZE")).toBeNull();
    expect(requestRefusal(true, [{ phase: "ANALYZE", status: "CHANGES_REQUESTED", requestedAt: at("2026-03-18") }], "ANALYZE")).toBeNull();
  });

  it("le passage accordé ouvre la phase suivante ; après « Contrôler », la démarche est close", () => {
    expect(phaseAfterApproval("ANALYZE")).toBe("IMPROVE");
    expect(phaseAfterApproval("CONTROL")).toBeNull();
  });

  it("exige un commentaire pour demander des compléments", () => {
    expect(checkDecision("CHANGES", "  ")).toEqual({ ok: false });
    expect(checkDecision("CHANGES", " Mesurer sur 3 mois ")).toEqual({ ok: true, comment: "Mesurer sur 3 mois" });
    expect(checkDecision("APPROVE", "")).toEqual({ ok: true, comment: null });
  });
});
