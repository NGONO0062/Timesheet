// Profils de démonstration (bloc « Prototype uniquement » de l'écran de connexion).
// Désactivé par défaut : il n'existe que si DEMO_PROFILES vaut « true »
// (PROMPT.md §10). Ne jamais l'activer sur un serveur de production.

export const DEMO_ACCOUNTS = [
  { label: "Staff", email: "aicha.ndongo@exemple.com" },
  { label: "Manager", email: "samuel.etoga@exemple.com" },
  { label: "Owner", email: "brigitte.mbarga@exemple.com" },
  { label: "Admin division", email: "paul.tchouta@exemple.com" },
  { label: "Admin plateforme", email: "rose.ekambi@exemple.com" },
] as const;

type Env = Partial<Record<"NODE_ENV" | "APP_URL" | "DEMO_PROFILES", string>>;

/** Adresse servie sur ce poste seulement (staging local, développement). */
export function isLocalUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Les profils entrent sans mot de passe : en production, ils ne sont acceptés que
 * sur une adresse locale (staging sur ce poste), jamais sur un serveur joignable.
 */
export function demoProfilesAllowed(env: Env): boolean {
  if (env.DEMO_PROFILES !== "true") return false;
  return env.NODE_ENV !== "production" || isLocalUrl(env.APP_URL);
}

export function demoProfilesEnabled(): boolean {
  return demoProfilesAllowed(process.env);
}

/** Réglages qui empêchent de démarrer en production ; liste vide si tout va bien. */
export function productionConfigProblems(env: Env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const problems: string[] = [];
  if (!env.APP_URL) problems.push("APP_URL est vide : les liens des e-mails pointeraient vers localhost.");
  if (env.DEMO_PROFILES === "true" && !isLocalUrl(env.APP_URL)) problems.push("DEMO_PROFILES vaut « true » sur une adresse publique : connexion sans mot de passe.");
  return problems;
}
