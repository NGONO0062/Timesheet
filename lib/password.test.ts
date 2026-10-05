import { describe, expect, it } from "vitest";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";

describe("mots de passe (argon2id)", () => {
  it("vérifie le bon mot de passe et refuse les autres", async () => {
    const hash = await hashPassword("Demo-TimeSheet-2026");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("Demo-TimeSheet-2026", hash)).toBe(true);
    expect(await verifyPassword("demo-timesheet-2026", hash)).toBe(false);
  });

  it("sale chaque hachage", async () => {
    expect(await hashPassword("même")).not.toBe(await hashPassword("même"));
  });

  it("refuse un hachage illisible sans lever d'erreur", async () => {
    expect(await verifyPassword("x", "pas-un-hachage")).toBe(false);
    expect(await verifyAgainstDummy("x")).toBe(false);
  });
});
