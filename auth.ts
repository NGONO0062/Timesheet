// Authentification (PROMPT.md §3, §16) : Auth.js, e-mail et mot de passe,
// sessions JWT (choix validé le 5 octobre : le fournisseur Credentials
// d'Auth.js n'accepte pas les sessions en base). Le jeton ne porte que
// l'identifiant ; chaque requête relit le compte en base (lib/data/viewer.ts),
// donc un compte désactivé perd l'accès tout de suite.
// Un SSO s'ajoutera comme un fournisseur de plus, sans toucher aux permissions.
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { appendAudit, countRecentLoginFailures } from "@/lib/data/audit";
import { canSignIn, findLoginAccount } from "@/lib/data/users";
import { verifyAgainstDummy, verifyPassword } from "@/lib/password";
import { DEMO_ACCOUNTS, demoProfilesEnabled } from "@/lib/demo";

/**
 * Limitation des tentatives, sur 15 minutes : 5 échecs pour une adresse depuis un
 * même poste, 20 échecs pour une adresse au total. Un tiers ne peut donc pas
 * bloquer le compte d'un collègue depuis son propre poste en 5 essais.
 */
export const LOGIN_MAX_FAILURES_PER_IP = 5;
export const LOGIN_MAX_FAILURES_TOTAL = 20;
export const LOGIN_WINDOW_MS = 15 * 60_000;

/** Adresse IP du client, telle que transmise par le proxy d'entrée. */
function clientIp(request: Request | undefined): string {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request?.headers.get("x-real-ip") || "inconnue";
}

class InvalidCredentials extends CredentialsSignin {
  code = "identifiants";
}
class TooManyAttempts extends CredentialsSignin {
  code = "tentatives";
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});

async function fail(email: string, ip: string, reason: string, accountId?: string, divisionId?: string | null): Promise<never> {
  await appendAudit({
    actorId: accountId ?? null,
    actorLabel: email,
    divisionId: divisionId ?? null,
    action: "LOGIN_FAILURE",
    objectLabel: email,
    result: "FAILURE",
    // La raison reste dans le journal ; l'écran ne dit jamais lequel des deux champs est faux.
    metadata: { reason, ip },
  });
  throw new InvalidCredentials();
}

const nextAuth = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  // Un mot de passe faux n'est pas une erreur du serveur : il est déjà au journal d'audit.
  logger: {
    error(error) {
      if (error.name === "CredentialsSignin") return;
      console.error(error);
    },
  },
  pages: { signIn: "/connexion", error: "/connexion" },
  providers: [
    Credentials({
      id: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();
        const { email, password } = parsed.data;
        const ip = clientIp(request);

        // Fenêtre de sécurité en heure réelle (et non l'horloge de démonstration).
        const since = new Date(Date.now() - LOGIN_WINDOW_MS);
        const [fromHere, total] = await Promise.all([countRecentLoginFailures(email, since, ip), countRecentLoginFailures(email, since)]);
        if (fromHere >= LOGIN_MAX_FAILURES_PER_IP || total >= LOGIN_MAX_FAILURES_TOTAL) {
          await appendAudit({ actorLabel: email, action: "LOGIN_FAILURE", objectLabel: email, result: "FAILURE", metadata: { reason: "tentatives", ip } });
          throw new TooManyAttempts();
        }

        const account = await findLoginAccount(email);
        if (!account?.passwordHash) {
          await verifyAgainstDummy(password);
          return fail(email, ip, "compte-inconnu");
        }
        if (!(await verifyPassword(password, account.passwordHash))) return fail(email, ip, "mot-de-passe", account.id, account.divisionId);
        if (!canSignIn(account)) return fail(email, ip, "compte-inactif", account.id, account.divisionId);

        await appendAudit({
          actorId: account.id,
          actorLabel: `${account.firstName} ${account.lastName}`,
          divisionId: account.divisionId,
          action: "LOGIN_SUCCESS",
          objectLabel: email,
          result: "SUCCESS",
        });
        return { id: account.id, email: account.email, name: `${account.firstName} ${account.lastName}` };
      },
    }),
    // Prototype uniquement (PROMPT.md §10) : entrer avec un profil de démonstration,
    // sans mot de passe. Inactif tant que DEMO_PROFILES n'est pas à « true ».
    Credentials({
      id: "demo",
      credentials: { email: {} },
      async authorize(raw) {
        if (!demoProfilesEnabled()) return null;
        const email = typeof raw?.email === "string" ? raw.email : "";
        if (!DEMO_ACCOUNTS.some((a) => a.email === email)) return null;
        const account = await findLoginAccount(email);
        if (!account || !canSignIn(account)) return null;
        await appendAudit({
          actorId: account.id,
          actorLabel: `${account.firstName} ${account.lastName}`,
          divisionId: account.divisionId,
          action: "LOGIN_SUCCESS",
          objectLabel: email,
          result: "SUCCESS",
          metadata: { mode: "profil-de-demonstration" },
        });
        return { id: account.id, email: account.email, name: `${account.firstName} ${account.lastName}` };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

export const { auth, signIn, signOut } = nextAuth;
export const { GET, POST } = nextAuth.handlers;
