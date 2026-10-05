// Horloge de l'application. En démonstration, TIMESHEET_NOW fixe le point de
// départ (ex. « 2026-03-19T09:42:00Z », semaine 12 des maquettes) et le temps
// avance ensuite normalement. Vide : l'heure réelle.
const startedAt = Date.now();

export function now(): Date {
  const fixed = process.env.TIMESHEET_NOW?.trim();
  if (!fixed) return new Date();
  const origin = Date.parse(fixed);
  if (Number.isNaN(origin)) throw new Error(`TIMESHEET_NOW invalide : « ${fixed} »`);
  return new Date(origin + (Date.now() - startedAt));
}
