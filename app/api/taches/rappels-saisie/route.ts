// Rappel de saisie (PROMPT.md §9.11) : les semaines incomplètes reçoivent un e-mail avant
// l'échéance, une fois par personne et par semaine, si la préférence est active.
// À appeler par le planificateur de l'hébergement, le vendredi à 12:00 (heure de Douala) :
//   curl -X POST -H "Authorization: Bearer $TASKS_SECRET" https://…/api/taches/rappels-saisie
import { timingSafeEqual } from "node:crypto";
import { now } from "@/lib/clock";
import { sendFillReminders } from "@/lib/data/reminders";

function authorized(request: Request): boolean {
  const secret = process.env.TASKS_SECRET ?? "";
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (secret.length < 32 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  const sent = await sendFillReminders(now());
  return Response.json({ rappels: sent });
}
