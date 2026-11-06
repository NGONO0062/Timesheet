import { describe, expect, it } from "vitest";
import { demoProfilesAllowed, isLocalUrl, productionConfigProblems } from "./demo";

describe("profils de démonstration", () => {
  it("désactivés par défaut", () => {
    expect(demoProfilesAllowed({ NODE_ENV: "development" })).toBe(false);
  });

  it("actifs en développement quand DEMO_PROFILES vaut true", () => {
    expect(demoProfilesAllowed({ NODE_ENV: "development", DEMO_PROFILES: "true" })).toBe(true);
  });

  it("en production, seulement sur une adresse locale", () => {
    expect(demoProfilesAllowed({ NODE_ENV: "production", DEMO_PROFILES: "true", APP_URL: "http://localhost:3000" })).toBe(true);
    expect(demoProfilesAllowed({ NODE_ENV: "production", DEMO_PROFILES: "true", APP_URL: "https://timesheet.exemple.com" })).toBe(false);
    expect(demoProfilesAllowed({ NODE_ENV: "production", DEMO_PROFILES: "true" })).toBe(false);
  });

  it("reconnaît les adresses locales", () => {
    expect(isLocalUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalUrl("https://localhost.exemple.com")).toBe(false);
    expect(isLocalUrl("pas une adresse")).toBe(false);
  });
});

describe("configuration de production", () => {
  it("rien à signaler hors production", () => {
    expect(productionConfigProblems({ NODE_ENV: "development" })).toEqual([]);
  });

  it("APP_URL obligatoire", () => {
    expect(productionConfigProblems({ NODE_ENV: "production" })).toHaveLength(1);
    expect(productionConfigProblems({ NODE_ENV: "production", APP_URL: "https://timesheet.exemple.com" })).toEqual([]);
  });

  it("profils de démonstration refusés sur une adresse publique", () => {
    expect(productionConfigProblems({ NODE_ENV: "production", APP_URL: "https://timesheet.exemple.com", DEMO_PROFILES: "true" })).toHaveLength(1);
    expect(productionConfigProblems({ NODE_ENV: "production", APP_URL: "http://localhost:3000", DEMO_PROFILES: "true" })).toEqual([]);
  });
});
