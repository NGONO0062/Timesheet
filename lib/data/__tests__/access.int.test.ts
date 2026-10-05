import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectivePermissions } from "@/lib/permissions";
import { appendAudit, countRecentLoginFailures } from "../audit";
import { prisma, type DivisionScope } from "../db";
import { listDivisionUsers, loadViewer } from "../users";

// Tests sur la base du seed. Une division de test est créée puis supprimée.
const RUN = Date.now().toString(36);
let divisionA: string;
let divisionB: string;
let userB: string;

const scope = (divisionId: string): DivisionScope => ({
  divisionId,
  userId: "test",
  role: "DIVISION_ADMIN",
  permissions: effectivePermissions("DIVISION_ADMIN"),
});

beforeAll(async () => {
  divisionA = (await prisma.division.findUniqueOrThrow({ where: { slug: "cx-expertise" } })).id;
  divisionB = (await prisma.division.create({ data: { name: `Division de test ${RUN}`, slug: `test-${RUN}`, direction: "TEST", status: "ACTIVE" } })).id;
  userB = (
    await prisma.user.create({
      data: { divisionId: divisionB, email: `isolation-${RUN}@exemple.com`, firstName: "Test", lastName: "Isolation", role: "STAFF" },
    })
  ).id;
});

afterAll(async () => {
  await prisma.rolePermission.deleteMany({ where: { divisionId: divisionB } });
  await prisma.user.deleteMany({ where: { divisionId: divisionB } });
  await prisma.division.delete({ where: { id: divisionB } });
  await prisma.$disconnect();
});

describe("utilisateur connecté relu en base", () => {
  it("reconstruit le stagiaire avec ses permissions", async () => {
    const aicha = await prisma.user.findUniqueOrThrow({ where: { email: "aicha.ndongo@exemple.com" } });
    expect(await loadViewer(aicha.id)).toMatchObject({
      firstName: "Aïcha",
      role: "STAFF",
      divisionName: "CX Expertise",
      isIntern: true,
      permissions: ["ENTER_TIME"],
    });
  });

  it("refuse un compte désactivé, même avec une session encore valide", async () => {
    const off = await prisma.user.findUniqueOrThrow({ where: { email: "marie-claire.abega@exemple.com" } });
    expect(off.active).toBe(false);
    expect(await loadViewer(off.id)).toBeNull();
  });

  it("refuse un compte d'une division suspendue", async () => {
    await prisma.division.update({ where: { id: divisionB }, data: { status: "SUSPENDED" } });
    expect(await loadViewer(userB)).toBeNull();
    await prisma.division.update({ where: { id: divisionB }, data: { status: "ACTIVE" } });
    expect(await loadViewer(userB)).not.toBeNull();
  });

  it("applique les réglages de permissions de sa division seulement", async () => {
    await prisma.rolePermission.create({ data: { divisionId: divisionB, role: "STAFF", permission: "VIEW_REPORTING", granted: true } });
    expect((await loadViewer(userB))?.permissions).toContain("VIEW_REPORTING");
    const aicha = await prisma.user.findUniqueOrThrow({ where: { email: "aicha.ndongo@exemple.com" } });
    expect((await loadViewer(aicha.id))?.permissions).not.toContain("VIEW_REPORTING");
  });
});

describe("isolation entre divisions", () => {
  it("ne renvoie jamais les utilisateurs d'une autre division", async () => {
    const inA = await listDivisionUsers(scope(divisionA));
    const inB = await listDivisionUsers(scope(divisionB));
    expect(inA).toHaveLength(21);
    expect(inA.some((u) => u.id === userB)).toBe(false);
    expect(inB.map((u) => u.id)).toEqual([userB]);
  });

  it("refuse un contexte sans division", async () => {
    await expect(listDivisionUsers(scope(""))).rejects.toThrow(/divisionId manquant/);
  });
});

describe("journal d'audit", () => {
  it("compte les échecs récents de connexion d'une adresse", async () => {
    const email = `limite-${RUN}@exemple.com`;
    for (let i = 0; i < 3; i++) await appendAudit({ actorLabel: email, action: "LOGIN_FAILURE", objectLabel: email, result: "FAILURE" });
    expect(await countRecentLoginFailures(email, new Date(Date.now() - 60_000))).toBe(3);
    expect(await countRecentLoginFailures(email, new Date(Date.now() + 60_000))).toBe(0);
    await appendAudit({ actorLabel: email, action: "LOGIN_FAILURE", objectLabel: email, result: "FAILURE", metadata: { ip: "10.0.0.7" } });
    expect(await countRecentLoginFailures(email, new Date(Date.now() - 60_000), "10.0.0.7")).toBe(1);
    expect(await countRecentLoginFailures(email, new Date(Date.now() - 60_000))).toBe(4);
  });

  it("refuse toute modification et toute suppression, même directe", async () => {
    const row = await prisma.auditLog.findFirstOrThrow({ where: { objectLabel: `limite-${RUN}@exemple.com` } });
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { objectLabel: "modifié" } })).rejects.toThrow(/ajout seul/);
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/ajout seul/);
  });
});
