// Export du reporting (PROMPT.md §9.5) : CSV, Excel ou PDF, avec les filtres de l'écran.
import { getViewer } from "@/lib/data/viewer";
import { htmlToPdf } from "@/lib/export/pdf";
import { toCsv, toXlsx } from "@/lib/export/table";
import { formatDateAt } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { reportHtml, reportRows } from "@/lib/reporting/exports";
import { loadReport } from "../load";

const TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.divisionId || !viewer.permissions.includes("VIEW_REPORTING")) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (format !== "csv" && format !== "xlsx" && format !== "pdf") return new Response(null, { status: 400 });

  const sp = Object.fromEntries(url.searchParams) as { axe?: string; de?: string; a?: string; personne?: string };
  const { at, params, view, person, people, whole } = await loadReport(viewer, sp);
  const name = t(dict.reporting.fileName, { from: `${params.from.year}-S${params.from.week}`, to: `${params.to.year}-S${params.to.week}` });
  const scopeLabel = person?.name ?? t(whole ? dict.reporting.wholeDivision : dict.reporting.wholeTeam, { n: people.length });

  let body: Uint8Array | string;
  if (format === "csv") body = toCsv(reportRows(view));
  else if (format === "xlsx") body = toXlsx({ name: dict.reporting.title, rows: reportRows(view) });
  else {
    body = await htmlToPdf(
      reportHtml(view, { scope: scopeLabel, generated: t(dict.reporting.pdfGenerated, { date: formatDateAt(at), name: `${viewer.firstName} ${viewer.lastName}` }) }),
      { landscape: view.weeks.length > 6 },
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
