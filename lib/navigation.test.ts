import { describe, expect, it } from "vitest";
import { effectivePermissions, type Role } from "./permissions";
import { homeFor, isCurrent, navigationFor } from "./navigation";

const viewer = (role: Role, isIntern = false) => ({ role, isIntern, permissions: [...effectivePermissions(role)] });
const labels = (role: Role, isIntern = false) => navigationFor(viewer(role, isIntern)).map((i) => i.label);

describe("navigation par permissions (§6)", () => {
  it("donne au stagiaire les trois liens Staff", () => {
    expect(labels("STAFF", true)).toEqual(["Tableau de bord", "Saisie hebdomadaire", "Fiche de présence"]);
  });

  it("masque la fiche de présence pour un staff non stagiaire", () => {
    expect(labels("STAFF")).toEqual(["Tableau de bord", "Saisie hebdomadaire"]);
  });

  it("donne au manager qui saisit ses temps les liens Staff en plus des siens", () => {
    expect(labels("MANAGER")).toEqual(["Tableau de bord", "Saisie hebdomadaire", "Validation", "Projets", "Reporting"]);
  });

  it("suit la matrice pour l'owner", () => {
    expect(labels("OWNER")).toEqual(["Vue division", "Validation", "Projets", "Reporting"]);
  });

  it("donne à l'admin plateforme les divisions et le journal", () => {
    expect(labels("PLATFORM_ADMIN")).toEqual(["Divisions", "Journal d'audit"]);
  });

  it("suit les permissions effectives, pas le nom du rôle", () => {
    const manager = {
      role: "MANAGER" as const,
      isIntern: false,
      permissions: [...effectivePermissions("MANAGER", [{ role: "MANAGER", permission: "ENTER_TIME", granted: false }])],
    };
    expect(navigationFor(manager).map((i) => i.label)).toEqual(["Validation", "Projets", "Reporting"]);
    expect(homeFor(manager)).toBe("/validation");
  });

  it("ouvre sur le premier lien du rôle", () => {
    expect(homeFor(viewer("STAFF", true))).toBe("/tableau-de-bord");
    expect(homeFor(viewer("OWNER"))).toBe("/division");
    expect(homeFor(viewer("DIVISION_ADMIN"))).toBe("/administration");
    expect(homeFor(viewer("PLATFORM_ADMIN"))).toBe("/plateforme");
  });

  it("marque le lien courant, sous-pages comprises", () => {
    expect(isCurrent("/validation", "/validation/abc")).toBe(true);
    expect(isCurrent("/saisie", "/saisie/2026/12")).toBe(true);
    expect(isCurrent("/plateforme", "/plateforme/journal")).toBe(false);
    expect(isCurrent("/plateforme", "/plateforme/divisions/nouvelle")).toBe(true);
  });
});
