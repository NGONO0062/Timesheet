import { describe, expect, it } from "vitest";
import { auditQuery, parseAuditParams, slugify } from "./filters";

describe("plateforme : filtres du journal et identifiant", () => {
  it("lit et réécrit les filtres de l'adresse", () => {
    const f = parseAuditParams(new URLSearchParams("type=RULES&du=16/03/2026&au=20/03/2026&q=seuil&page=3"));
    expect(f).toEqual({ division: null, type: "RULES", from: "16/03/2026", to: "20/03/2026", q: "seuil", page: 3 });
    expect(auditQuery(f).toString()).toBe("type=RULES&du=16%2F03%2F2026&au=20%2F03%2F2026&q=seuil");
    expect(auditQuery(f, true).get("page")).toBe("3");
    expect(parseAuditParams(new URLSearchParams("page=-2")).page).toBe(1);
  });

  it("propose un identifiant sans accent ni espace", () => {
    expect(slugify("Division créée e2e")).toBe("division-creee-e2e");
    expect(slugify("  Expérience — boutiques !  ")).toBe("experience-boutiques");
  });
});
