import { describe, expect, it } from "vitest";
import type { AttendanceSheet } from "../api/types";
import { attendanceError, blocksNote, currentStep, hrView, monthLabel, rejectedAlert, stepText } from "./view";

const sheet = (over: Partial<AttendanceSheet> = {}): AttendanceSheet => ({
  id: "1",
  year: 2026,
  month: 2,
  status: "GENERATED",
  generatedAt: "2026-03-09T07:00:00Z",
  fileName: "Fiche_presence_2026-02_NDONGO.pdf",
  html: "",
  usedWeeks: 4,
  internName: "Aïcha Ndongo",
  arrival: "08:00",
  departure: "17:00",
  supervisorName: "Samuel Etoga",
  internSignature: null,
  supervisorSignature: null,
  rejectionReason: null,
  rejectedAt: null,
  sentAt: null,
  sentTo: null,
  hrEmail: null,
  hrAutoSend: true,
  observation: "",
  canSign: true,
  ...over,
});

describe("fiche de présence : affichage", () => {
  it("nomme le mois et place l'étape du circuit", () => {
    expect(monthLabel(2026, 2)).toBe("Février 2026");
    expect(currentStep("GENERATED")).toBe(1);
    expect(currentStep("SENT")).toBe(4);
  });

  it("décrit l'étape comme la planche 06", () => {
    expect(stepText(sheet(), false)).toBe(
      "Étape 2 sur 4. Fiche générée le 9 mars 2026 à partir de vos quatre semaines validées. Votre signature est attendue. Après la signature du superviseur, la fiche est envoyée par e-mail aux RH, PDF en pièce jointe.",
    );
    const signed = sheet({ status: "SIGNED_BY_INTERN", internSignature: { name: "Aïcha Ndongo", role: "STAFF", method: "PASSWORD", drawing: null, signedAt: "2026-03-19T09:48:00Z", sha256: "x" } });
    expect(stepText(signed, false)).toContain("Vous avez signé le 19 mars 2026 à 10:48. La signature de Samuel Etoga");
    expect(stepText(signed, true)).toContain("Aïcha Ndongo a signé sa fiche le 19 mars 2026 à 10:48.");
  });

  it("explique les blocs vides", () => {
    expect(blocksNote(sheet())).toBe("Les deux derniers blocs restent vides : février 2026 compte quatre semaines.");
    expect(blocksNote(sheet({ usedWeeks: 5 }))).toBe("Le dernier bloc reste vide : février 2026 compte cinq semaines.");
    expect(blocksNote(sheet({ usedWeeks: 6 }))).toBe("");
  });

  it("affiche le renvoi tant que la fiche n'est pas signée de nouveau", () => {
    const back = sheet({ rejectionReason: "Le 13 février était un jour d'absence.", rejectedAt: "2026-03-20T09:00:00Z" });
    expect(rejectedAlert(back)).toContain("Fiche renvoyée par Samuel Etoga le 20 mars 2026. Motif : « Le 13 février était un jour d'absence. »");
    expect(rejectedAlert(sheet())).toBeNull();
  });

  it("n'offre l'envoi aux RH qu'au superviseur, une fois la fiche contre-signée", () => {
    expect(hrView(sheet(), true)).toMatchObject({ recipient: "Adresse des RH non renseignée", missing: true, canSend: false });
    expect(hrView(sheet({ status: "SIGNED_BY_SUPERVISOR", hrEmail: "rh@exemple.com" }), true).canSend).toBe(true);
    expect(hrView(sheet({ status: "SIGNED_BY_SUPERVISOR", hrEmail: "rh@exemple.com" }), false).canSend).toBe(false);
    expect(attendanceError("throttled")).toBe("Trop de tentatives. Réessayez dans 15 minutes ou signez par tracé.");
  });
});
