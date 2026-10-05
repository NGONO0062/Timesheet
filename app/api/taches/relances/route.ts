// Relance automatique du validateur (PROMPT.md §9.3) : une fiche soumise depuis
// N jours ouvrés sans décision déclenche un e-mail au validateur, une fois par
// soumission. À appeler par le planificateur de l'hébergement, chaque jour ouvré :
//   curl -X POST -H "Authorization: Bearer $TASKS_SECRET" https://…/api/taches/relances
import { timingSafeEqual } from "node:crypto";
import { now } from "@/lib/clock";
import { sendDueReminders } from "@/lib/data/validation";

function authorized(request: Request): boolean {
  const secret = process.env.TASKS_SECRET ?? "";
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (secret.length < 32 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  const sent = await sendDueReminders(now());
  return Response.json({ relances: sent });
}
