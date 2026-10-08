import { describe, expect, it } from "vitest";
import { NBSP } from "../format";
import type { IsoWeek } from "../iso-week";
import type { StoredStatus } from "../timesheet/rules";
import {
  budgetDrifts, driftRow, fillRate, fillText, kpiTexts, lateDrifts, missingDrifts, NO_TEAM, sortDrifts, teamTable, trend, underfillDrifts,
  type Member, type PersonWeek, type TeamInfo,
} from "./consolidated";

const W12: IsoWeek = { year: 2026, week: 12 };
const W11: IsoWeek = { year: 2026, week: 11 };
const friday = (w: IsoWeek) => new Date(Date.UTC(2026, 2, w.week === 12 ? 20 : 13, 17));
const now = new Date(Date.UTC(2026, 2, 19, 8, 42)); // jeudi 19 mars, 09:42 à Douala

const teams: TeamInfo[] = [
  { id: "data", name: "Data CX", managerId: "om", manager: "Olivier Manga" },
  { id: "parcours", name: "Parcours", managerId: "se", manager: "Samuel Etoga" },
];
const member = (id: string, teamId: string | null, managerId = "se", manager = "Samuel Etoga"): Member => ({ id, name: id, teamId, managerId, manager });
const people = [member("a", "parcours"), member("b", "parcours"), member("c", "data", "om", "Olivier Manga"), member("d", null)];
const state = (personId: string, week: IsoWeek, hours: number, stored: StoredStatus | null): PersonWeek => ({ personId, week, hours, stored, deadline: friday(week) });

describe("vue consolidée", () => {
  it("calcule le taux de remplissage en pour cent entier", () => {
    expect(fillRate(516, 600)).toBe(86);
    expect(fillRate(120, 160)).toBe(75);
    expect(fillRate(10, 0)).toBe(0);
  });

  it("construit le tableau par équipe, la ligne Sans équipe et la ligne Division", () => {
    const states = [state("a", W12, 40, "SUBMITTED"), state("b", W12, 20, "DRAFT"), state("c", W12, 40, "VALIDATED"), state("a", W11, 40, "VALIDATED")];
    const { rows, total } = teamTable({ teams, people, states, week: W12, weekCapacity: 40, threshold: 80 });
    expect(rows.map((r) => r.name)).toEqual(["Parcours", "Data CX", "Sans équipe"]);
    const parcours = rows[0]!;
    expect(parcours).toMatchObject({ persons: 2, entered: 60, capacity: 80, fill: 75, submitted: 1, validated: 0, under: true });
    expect(rows[1]).toMatchObject({ fill: 100, submitted: 1, validated: 1, under: false });
    expect(rows[2]!.id).toBe(NO_TEAM);
    expect(total).toMatchObject({ persons: 4, entered: 100, capacity: 160, submitted: 2, validated: 1 });
    expect(fillText(parcours)).toBe(`75${NBSP}% · 60 / 80${NBSP}h`);
  });

  it("écrit les indicateurs de la semaine", () => {
    const { total } = teamTable({ teams, people, states: [state("a", W12, 40, "SUBMITTED"), state("c", W12, 40, "VALIDATED")], week: W12, weekCapacity: 40, threshold: 80 });
    const k = kpiTexts(total);
    expect(k.fill).toBe(`50${NBSP}%`);
    expect(k.submitted).toBe("2 sur 4");
    expect(k.submittedDetail).toBe("2 fiches non soumises");
    expect(k.validatedDetail).toBe("1 en attente chez les managers");
    const empty = kpiTexts(teamTable({ teams, people, states: [], week: W12, weekCapacity: 40, threshold: 80 }).total);
    expect(empty.submittedDetail).toBe("Aucune fiche soumise cette semaine");
    expect(empty.validatedDetail).toBe("Aucune fiche en attente");
  });

  it("trace la tendance avec la semaine en cours évidée", () => {
    const columns = trend({ weeks: [W11, W12], states: [state("a", W11, 40, "VALIDATED"), state("a", W12, 20, "DRAFT")], persons: 1, weekCapacity: [40, 40], current: W12 });
    expect(columns.map((c) => [c.label, c.fill, c.open])).toEqual([["S11", 100, false], ["S12", 50, true]]);
    expect(columns[0]!.height).toBe(160);
    expect(columns[1]!.title).toBe(`Semaine 12, en cours : 50${NBSP}%`);
  });

  it("détecte les quatre dérives et les range dans l'ordre de la planche", () => {
    const budget = budgetDrifts([
      { id: "nps", name: "Baromètre NPS T1 2026", consumed: 410, budget: 400, owner: "Samuel Etoga" },
      { id: "ok", name: "Dans le budget", consumed: 100, budget: 400, owner: null },
      { id: "libre", name: "Sans budget", consumed: 900, budget: null, owner: null },
    ]);
    expect(budget).toHaveLength(1);
    expect(driftRow(budget[0]!).gap).toBe(`410${NBSP}h consommées pour 400${NBSP}h prévues (+10${NBSP}h)`);

    const { rows } = teamTable({ teams, people, states: [state("c", W12, 30, "SUBMITTED")], week: W12, weekCapacity: 40, threshold: 80 });
    const under = underfillDrifts(rows, W12, 80);
    expect(under.map((u) => driftRow(u).object)).toEqual(["Équipe Parcours · semaine 12", "Équipe Data CX · semaine 12"]);

    const late = lateDrifts(
      [
        { managerId: "om", manager: "Olivier Manga", team: "Data CX", late: true },
        { managerId: "om", manager: "Olivier Manga", team: "Data CX", late: true },
        { managerId: "se", manager: "Samuel Etoga", team: "Parcours", late: false },
      ],
      3,
    );
    expect(late).toHaveLength(1);
    expect(driftRow(late[0]!)).toMatchObject({ gap: "2 fiches en attente depuis plus de 3 jours", owner: "Olivier Manga", action: { kind: "remindManager" } });

    const missing = missingDrifts({
      people: [member("Aïcha Ndongo", "parcours")],
      states: [state("Aïcha Ndongo", W12, 0, null)],
      weeks: [W11, W12],
      expected: [40, 40],
      now,
      deadlines: [friday(W11), friday(W12)],
    });
    // Semaine 11 : échéance passée, rien de soumis ; semaine 12 : échéance à venir.
    expect(missing.map((m) => driftRow(m).object)).toEqual(["Aïcha Ndongo · semaine 11"]);
    expect(driftRow(missing[0]!).gap).toBe(`40${NBSP}h non saisies`);

    const all = sortDrifts([...missing, ...late, ...under, ...budget]);
    expect(all.map((x) => x.kind)).toEqual(["BUDGET", "UNDERFILL", "UNDERFILL", "LATE_VALIDATION", "MISSING"]);
  });

  it("ne signale pas la ligne Sans équipe en sous-remplissage", () => {
    const { rows } = teamTable({ teams: [], people: [member("x", null)], states: [], week: W12, weekCapacity: 40, threshold: 80 });
    expect(rows[0]!.under).toBe(true);
    expect(underfillDrifts(rows, W12, 80)).toEqual([]);
  });
});
