// Rappel de saisie (PROMPT.md §9.11) : les semaines incomplètes reçoivent un e-mail avant
// l'échéance, une fois par personne et par semaine, si la préférence est active.
// À appeler par le planificateur de l'hébergement, le vendredi à 12:00 (heure de Douala) :
//   curl -X POST -H "Authorization: Bearer $TASKS_SECRET" https://…/api/taches/rappels-saisie
import { now } from "@/lib/clock";
import { scheduledTaskAuthorized } from "@/lib/scheduled";
import { sendFillReminders } from "@/lib/data/reminders";

export async function POST(request: Request) {
  if (!scheduledTaskAuthorized(request)) return new Response(null, { status: 401 });
  const sent = await sendFillReminders(now());
  return Response.json({ rappels: sent });
}
