import { describe, expect, it } from "vitest";
import { checkAdmin, checkIdentity, isSlug, slugify, splitName } from "./rules";

describe("onboarding d'une division", () => {
  it("propose un identifiant de tenant à partir du nom", () => {
    expect(slugify("Relation client B2B")).toBe("relation-client-b2b");
    expect(slugify("  Études & Données — Énergie ")).toBe("etudes-donnees-energie");
    expect(isSlug("cx-expertise")).toBe(true);
    expect(isSlug("CX")).toBe(false);
    expect(isSlug("ab")).toBe(false);
    expect(isSlug("a--b")).toBe(false);
    expect(isSlug("-ab")).toBe(false);
  });

  it("contrôle l'identité", () => {
    expect(checkIdentity({ name: "Relation client", slug: "relation-client", direction: "DEC" })).toEqual({});
    expect(Object.keys(checkIdentity({ name: " ", slug: "Rel Client", direction: "" })).sort()).toEqual(["direction", "name", "slug"]);
  });

  it("sépare le prénom du nom de l'administrateur", () => {
    expect(splitName("Jean-Marc  Essomba Ndi")).toEqual({ firstName: "Jean-Marc", lastName: "Essomba Ndi" });
    expect(splitName("Jean")).toBeNull();
    expect(checkAdmin({ fullName: "Jean", email: "jean@", config: "COPY" })).toEqual({
      fullName: "Saisissez le prénom et le nom de l'administrateur.",
      email: "Saisissez une adresse e-mail valide.",
    });
  });
});
