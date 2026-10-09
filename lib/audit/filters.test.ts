import { describe, expect, it } from "vitest";
import { utcDate } from "../iso-week";
import { auditQuery, defaultPeriod, parseAuditFilters } from "./filters";

const thursday = utcDate(2026, 3, 19);

describe("filtres du journal", () => {
  it("prend la semaine en cours par défaut, comme la planche 13", () => {
    const { filters, errors } = parseAuditFilters({}, thursday);
    expect(errors).toEqual({});
    expect([filters.fromText, filters.toText]).toEqual(["16/03/2026", "20/03/2026"]);
    // Jours de Douala (UTC+1) : du 15 mars 23:00 UTC au 20 mars 23:00 UTC exclu.
    expect(filters.from.toISOString()).toBe("2026-03-15T23:00:00.000Z");
    expect(filters.to.toISOString()).toBe("2026-03-20T23:00:00.000Z");
    expect(defaultPeriod(utcDate(2026, 3, 22)).to).toEqual(utcDate(2026, 3, 22));
  });

  it("refuse une date mal écrite ou une période à l'envers, sans rien filtrer de faux", () => {
    expect(parseAuditFilters({ du: "32/03/2026" }, thursday).errors.from).toBe("Saisissez une date au format jj/mm/aaaa.");
    const r = parseAuditFilters({ du: "20/03/2026", au: "16/03/2026" }, thursday);
    expect(r.errors.to).toBe("La date de fin doit suivre la date de début.");
    expect(r.filters.from.toISOString()).toBe("2026-03-15T23:00:00.000Z");
  });

  it("ne garde que des filtres connus", () => {
    const { filters } = parseAuditFilters({ type: "SUBMISSIONS", division: "abc123", q: "  Kevin ", page: "3" }, thursday);
    expect([filters.category, filters.divisionId, filters.q, filters.page]).toEqual(["SUBMISSIONS", "abc123", "Kevin", 3]);
    expect(parseAuditFilters({ type: "DROP TABLE", division: "x'; --", page: "-2" }, thursday).filters).toMatchObject({ category: null, divisionId: null, page: 1 });
    expect(auditQuery(filters).toString()).toBe("division=abc123&type=SUBMISSIONS&du=16%2F03%2F2026&au=20%2F03%2F2026&q=Kevin");
  });
});
