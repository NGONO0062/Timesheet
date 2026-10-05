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

export function demoProfilesEnabled(): boolean {
  return process.env.DEMO_PROFILES === "true";
}
