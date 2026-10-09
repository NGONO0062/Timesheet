// Export du journal d'audit (PROMPT.md §9.10) : CSV, Excel ou PDF, avec les filtres de l'écran.
import { auditHtml, auditRows } from "@/lib/audit/exports";
import { parseAuditFilters, type AuditParams } from "@/lib/audit/filters";
import { now } from "@/lib/clock";
import { exportAudit } from "@/lib/data/platform";
import { getViewer } from "@/lib/data/viewer";
import { htmlToPdf } from "@/lib/export/pdf";
import { toCsv, toXlsx } from "@/lib/export/table";
import { formatDateAt } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { todayInDivision } from "@/lib/iso-week";

const TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

const au = dict.audit;

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "PLATFORM_ADMIN") return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (format !== "csv" && format !== "xlsx" && format !== "pdf") return new Response(null, { status: 400 });

  const at = now();
  const { filters } = parseAuditFilters(Object.fromEntries(url.searchParams) as AuditParams, todayInDivision(at));
  const rows = await exportAudit({ userId: viewer.userId, role: viewer.role }, filters);
  const name = t(au.fileName, { from: filters.fromText.split("/").reverse().join("-"), to: filters.toText.split("/").reverse().join("-") });

  let body: Uint8Array | string;
  if (format === "csv") body = toCsv(auditRows(rows));
  else if (format === "xlsx") body = toXlsx({ name: au.title, rows: auditRows(rows) });
  else {
    body = await htmlToPdf(
      auditHtml(rows, { period: t(au.pdfPeriod, { from: filters.fromText, to: filters.toText }), generated: t(au.pdfGenerated, { date: formatDateAt(at), name: `${viewer.firstName} ${viewer.lastName}` }) }),
      { landscape: true },
    );
  }
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": TYPES[format],
      "Content-Disposition": `attachment; filename="${name}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
