// Première mise en service (docs/exploitation.md) : crée le compte de l'admin plateforme,
// sans mot de passe, et affiche un lien d'invitation à usage unique (7 jours) pour le
// choisir. Aucun écran ne crée ce compte ; le seed de démonstration ne va pas en production.
//
//   npm run plateforme:admin -- prenom.nom@orange.cm "Prénom" "Nom"
//
// Variables lues : DATABASE_URL, APP_URL.
import { createHash, randomBytes } from "node:crypto";
import prismaClient from "@prisma/client";

const [email, firstName, lastName] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !firstName || !lastName) {
  console.error('Usage : npm run plateforme:admin -- adresse@domaine "Prénom" "Nom"');
  process.exit(1);
}

const prisma = new prismaClient.PrismaClient();

async function main() {
  const address = email!.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: address } })) {
    console.error(`Un compte existe déjà avec l'adresse ${address}.`);
    process.exit(1);
  }
  const user = await prisma.user.create({
    data: { divisionId: null, email: address, firstName: firstName!.trim(), lastName: lastName!.trim(), role: "PLATFORM_ADMIN", passwordHash: null },
  });
  // Même format que lib/data/tokens.ts : seule l'empreinte du jeton est stockée.
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.passwordToken.create({
    data: { userId: user.id, kind: "INVITATION", tokenHash: createHash("sha256").update(token).digest("hex"), createdAt: now, expiresAt: new Date(now.getTime() + 7 * 86_400_000) },
  });
  await prisma.auditLog.create({
    data: { actorLabel: "Mise en service", action: "USER_INVITED", objectLabel: `${firstName} ${lastName} · ${address}`, result: "SUCCESS", metadata: { role: "PLATFORM_ADMIN" } },
  });
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  console.log(`Admin plateforme créé : ${firstName} ${lastName} <${address}>.`);
  console.log(`Lien pour choisir le mot de passe (7 jours, usage unique) : ${base}/invitation/${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
