import { redirect } from "next/navigation";
import { now } from "@/lib/clock";
import { currentWeek } from "@/lib/data/timesheets";
import { requirePermission } from "@/lib/data/viewer";
import { entryHref } from "@/lib/routes";

// « Saisie hebdomadaire » ouvre la semaine en cours.
export default async function Page() {
  await requirePermission("ENTER_TIME");
  redirect(entryHref(currentWeek(now())));
}
