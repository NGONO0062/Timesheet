import "server-only";
// Données du journal d'audit, communes à /plateforme et /plateforme/journal.
import { parseAuditFilters, type AuditParams } from "@/lib/audit/filters";
import { now } from "@/lib/clock";
import { listAudit, listDivisionOptions, type PlatformScope } from "@/lib/data/platform";
import { todayInDivision } from "@/lib/iso-week";

export async function loadAudit(scope: PlatformScope, sp: AuditParams) {
  const { filters, errors } = parseAuditFilters(sp, todayInDivision(now()));
  const [result, divisions] = await Promise.all([listAudit(scope, filters), listDivisionOptions(scope)]);
  return { filters, errors, result, divisions };
}
