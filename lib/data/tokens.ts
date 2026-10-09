import "server-only";
// Liens à usage unique (PROMPT.md §19) : invitation (première connexion) et mot de passe
// oublié. Seule l'empreinte SHA-256 du jeton est stockée ; le jeton n'existe que dans l'e-mail.
import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/password";
import { appendAudit } from "./audit";
import { prisma } from "./db";

export type TokenKind = "INVITATION" | "RESET";

const LIFETIME_MS: Record<TokenKind, number> = { INVITATION: 7 * 86_400_000, RESET: 60 * 60_000 };
const RESET_INTERVAL_MS = 2 * 60_000;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

/** Nouveau lien ; les liens encore valides du même type pour ce compte sont annulés. */
export async function issueToken(userId: string, kind: TokenKind, now: Date): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordToken.updateMany({ where: { userId, kind, usedAt: null }, data: { usedAt: now } }),
    // Dates sur l'horloge de l'application (TIMESHEET_NOW en démonstration), comme l'expiration.
    prisma.passwordToken.create({ data: { userId, kind, tokenHash: digest(token), createdAt: now, expiresAt: new Date(now.getTime() + LIFETIME_MS[kind]) } }),
  ]);
  return token;
}

async function find(token: string, kind: TokenKind, now: Date) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const row = await prisma.passwordToken.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, active: true, divisionId: true, division: { select: { status: true } } } } },
  });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt <= now || !row.user.active) return null;
  return row;
}

/** Compte du lien, s'il est encore valable (page de choix du mot de passe). */
export async function peekToken(token: string, kind: TokenKind, now: Date) {
  const row = await find(token, kind, now);
  return row ? { firstName: row.user.firstName, email: row.user.email } : null;
}

/** Choix du mot de passe : le lien est consommé. Renvoie false si le lien n'est plus valable. */
export async function consumeToken(token: string, kind: TokenKind, password: string, now: Date): Promise<boolean> {
  const row = await find(token, kind, now);
  if (!row) return false;
  const passwordHash = await hashPassword(password);
  const { count } = await prisma.passwordToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (count === 0) return false;
  await prisma.user.update({ where: { id: row.userId }, data: { passwordHash } });
  await appendAudit({
    actorId: row.userId,
    actorLabel: `${row.user.firstName} ${row.user.lastName}`,
    divisionId: row.user.divisionId,
    action: kind === "INVITATION" ? "INVITATION_ACCEPTED" : "PASSWORD_RESET",
    objectLabel: row.user.email,
    result: "SUCCESS",
  });
  return true;
}

/** Demande de réinitialisation : renvoie le lien seulement si le compte existe et peut se connecter. */
export async function requestReset(email: string, now: Date): Promise<{ token: string; firstName: string; email: string } | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, active: true, firstName: true, email: true, passwordHash: true } });
  if (!user?.active || !user.passwordHash) return null;
  // Une demande toutes les deux minutes au plus : pas de rafale d'e-mails vers une même adresse.
  const recent = await prisma.passwordToken.count({ where: { userId: user.id, kind: "RESET", createdAt: { gt: new Date(now.getTime() - RESET_INTERVAL_MS) } } });
  if (recent > 0) return null;
  return { token: await issueToken(user.id, "RESET", now), firstName: user.firstName, email: user.email };
}
