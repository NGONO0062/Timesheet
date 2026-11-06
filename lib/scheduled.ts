import "server-only";
// Tâches planifiées (/api/taches/…) : appelées par le planificateur de l'hébergement
// avec « Authorization: Bearer $TASKS_SECRET ». Sans secret de 32 caractères, tout est refusé.
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Comparaison en temps constant, sur les empreintes : même longueur quelle que soit l'entrée. */
export function scheduledTaskAuthorized(request: Request): boolean {
  const secret = process.env.TASKS_SECRET ?? "";
  if (secret.length < 32) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return timingSafeEqual(digest(given), digest(secret));
}
