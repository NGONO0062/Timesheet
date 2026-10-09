import { describe, expect, it } from "vitest";
import { sheetHtml } from "./html";
import { buildSheet, currentStep, monthLabel, monthsOfWeek, nextAttendanceStatus, sheetFileName, usedBlocks, weeksOfMonth, type SheetInput } from "./sheet";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

const base: SheetInput = {
  year: 2026,
  month: 2,
  firstName: "Aïcha",
  lastName: "Ndongo",
  internship: { kind: "PROFESSIONAL", direction: "DEC", department: "CX", service: "CX Expertise", startDate: d("2026-01-05"), endDate: d("2026-06-26") },
  arrival: "08:00",
  departure: "17:00",
  days: [],
};

describe("semaines du mois", () => {
  it("février 2026 : quatre semaines, du lundi 2 au vendredi 27", () => {
    expect(weeksOfMonth(2026, 2)).toEqual([6, 7, 8, 9].map((week) => ({ year: 2026, week })));
  });
  it("avril 2026 commence un mercredi : la semaine du 30 mars compte", () => {
    expect(weeksOfMonth(2026, 4)[0]).toEqual({ year: 2026, week: 14 });
    expect(weeksOfMonth(2026, 4)).toHaveLength(5);
  });
  it("seules les semaines de la période de stage comptent", () => {
    const within = { startDate: d("2026-01-05"), endDate: d("2026-06-26") };
    expect(weeksOfMonth(2026, 1)[0]).toEqual({ year: 2026, week: 1 });
    expect(weeksOfMonth(2026, 1, within)[0]).toEqual({ year: 2026, week: 2 });
    expect(weeksOfMonth(2026, 7, within)).toEqual([]);
  });
  it("une semaine à cheval figure sur les deux mois", () => {
    expect(monthsOfWeek(d("2026-03-30"))).toEqual([{ year: 2026, month: 3 }, { year: 2026, month: 4 }]);
    expect(monthsOfWeek(d("2026-03-16"))).toEqual([{ year: 2026, month: 3 }]);
  });
});

describe("contenu de la feuille", () => {
  const worked = (from: string, n: number) => Array.from({ length: n }, (_, i) => ({ date: new Date(d(from).getTime() + i * 86_400_000), hours: 8, absence: 0 }));

  it("horaires habituels les jours travaillés, six blocs dont deux vides", () => {
    const days = [0, 7, 14, 21].flatMap((offset) => worked(new Date(d("2026-02-02").getTime() + offset * 86_400_000).toISOString().slice(0, 10), 5));
    const m = buildSheet({ ...base, days });
    expect(m.name).toBe("NDONGO Aïcha");
    expect(m.from).toBe("05/01/2026");
    expect(m.blocks).toHaveLength(6);
    expect(usedBlocks(m)).toBe(4);
    expect(m.blocks[0]!.rows[0]).toEqual({ label: "Lundi 02/02", arrival: "08:00", departure: "17:00" });
    expect(m.blocks[3]!.rows[4]).toEqual({ label: "Vendredi 27/02", arrival: "08:00", departure: "17:00" });
    expect(m.blocks[4]!.rows[0]).toEqual({ label: "Lundi ............", arrival: "", departure: "" });
    expect(m.blocks[4]!.rows[2]!.label).toBe("Mercredi ........");
    expect(m.absenceDays).toBe(0);
  });

  it("un jour entièrement en absence reste vide et compte ; une absence partielle ne compte pas", () => {
    const m = buildSheet({
      ...base,
      days: [
        { date: d("2026-02-02"), hours: 8, absence: 8 },
        { date: d("2026-02-03"), hours: 8, absence: 4 },
        { date: d("2026-02-04"), hours: 8, absence: 0 },
      ],
    });
    expect(m.absenceDays).toBe(1);
    expect(m.blocks[0]!.rows.slice(0, 3).map((r) => r.arrival)).toEqual(["", "08:00", "08:00"]);
  });

  it("les jours d'une semaine à cheval qui tombent dans l'autre mois restent vides", () => {
    const m = buildSheet({ ...base, month: 4, days: [{ date: d("2026-03-31"), hours: 8, absence: 0 }, { date: d("2026-04-01"), hours: 8, absence: 0 }] });
    expect(m.blocks[0]!.rows[1]).toEqual({ label: "Mardi ............", arrival: "", departure: "" });
    expect(m.blocks[0]!.rows[2]).toEqual({ label: "Mercredi 01/04", arrival: "08:00", departure: "17:00" });
  });

  it("gabarit : nature du stage cochée, contenu échappé", () => {
    const html = sheetHtml(buildSheet({ ...base, observation: "<b>RAS</b>" }));
    expect(html).toContain('Professionnel <span class="ts-box is-checked" role="img" aria-label="coché">');
    expect(html).toContain("&lt;b&gt;RAS&lt;/b&gt;");
    expect(html).toContain("OCM/PS-01/SE/049");
  });
});

describe("fichier et circuit", () => {
  it("nom du fichier sans accent", () => {
    expect(sheetFileName(2026, 2, "Ndongo")).toBe("Fiche_presence_2026-02_NDONGO.pdf");
    expect(sheetFileName(2026, 11, "Bikoï Éyé")).toBe("Fiche_presence_2026-11_BIKOI-EYE.pdf");
  });
  it("mois en toutes lettres", () => {
    expect(monthLabel(2026, 2)).toBe("Février 2026");
  });
  it("transitions : stagiaire, superviseur, renvoi, envoi", () => {
    expect(nextAttendanceStatus("GENERATED", "INTERN_SIGN")).toBe("SIGNED_BY_INTERN");
    expect(nextAttendanceStatus("GENERATED", "SUPERVISOR_SIGN")).toBeNull();
    expect(nextAttendanceStatus("SIGNED_BY_INTERN", "SUPERVISOR_SIGN")).toBe("SIGNED_BY_SUPERVISOR");
    expect(nextAttendanceStatus("SIGNED_BY_INTERN", "SUPERVISOR_REJECT")).toBe("GENERATED");
    expect(nextAttendanceStatus("SIGNED_BY_SUPERVISOR", "SUPERVISOR_REJECT")).toBeNull();
    expect(nextAttendanceStatus("SIGNED_BY_SUPERVISOR", "SEND")).toBe("SENT");
    expect(nextAttendanceStatus("SENT", "SEND")).toBeNull();
    expect([currentStep("GENERATED"), currentStep("SENT")]).toEqual([1, 4]);
  });
});
