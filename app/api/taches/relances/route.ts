// Relance automatique du validateur (PROMPT.md §9.3) : une fiche soumise depuis
// N jours ouvrés sans décision déclenche un e-mail au validateur, une fois par
// soumission. À appeler par le planificateur de l'hébergement, chaque jour ouvré :
//   curl -X POST -H "Authorization: Bearer $TASKS_SECRET" https://…/api/taches/relances
import { now } from "@/lib/clock";
import { scheduledTaskAuthorized } from "@/lib/scheduled";
import { sendDueReminders } from "@/lib/data/validation";

export async function POST(request: Request) {
  if (!scheduledTaskAuthorized(request)) return new Response(null, { status: 401 });
  const sent = await sendDueReminders(now());
  return Response.json({ relances: sent });
}
