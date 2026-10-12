// Exports du reporting (PROMPT.md §9.5) : mêmes données que l'écran, même ordre.
// Purs : la route d'export fournit le modèle de vue.
import { documentHeadHtml, partiesHtml, summaryHtml } from "../export/brand";
import type { Cell } from "../export/table";
import { dict, t } from "../i18n";
import type { ReportView } from "./view";

const r = dict.reporting;
const doc = dict.document;

/** Tableau de détail : une ligne par entité, une colonne par semaine, total et part. */
export function reportRows(view: ReportView): Cell[][] {
  const axis = view.params.axis;
  const sub = r.colSub[axis];
  const count = r.colCount[axis];
  const head: Cell[] = [r.colEntity[axis], ...(sub ? [sub] : []), ...(count ? [count] : []), ...view.table.head, r.colTotal, r.colShare];
  const body = view.table.rows.map((row): Cell[] => [
    row.label,
    ...(sub ? [row.sub] : []),
    ...(count ? [row.count] : []),
    ...row.raw.byWeek,
    row.raw.total,
    Math.round(row.raw.share * 1000) / 10,
  ]);
  const foot: Cell[] = [r.total, ...(sub ? [null] : []), ...(count ? [null] : []), ...view.table.foot.raw.byWeek, view.table.foot.raw.total, 100];
  return [head, ...body, foot];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** En-tête du PDF : division, auteur, numéro et date d'édition (la route les fournit). */
export type ReportPdfMeta = { scope: string; division: string; issuedBy: string; number: string; date: string };

/** Document HTML imprimé en PDF, mis en page comme une proforma : en-tête, périmètre, détail, récapitulatif. */
export function reportHtml(view: ReportView, meta: ReportPdfMeta): string {
  const axis = view.params.axis;
  const sub = r.colSub[axis];
  const count = r.colCount[axis];
  const th = (s: string, num = false) => `<th${num ? ' class="num"' : ""}>${esc(s)}</th>`;
  const td = (s: string | number, num = false) => `<td${num ? ' class="num"' : ""}>${esc(String(s))}</td>`;
  const rows = view.table.rows
    .map((row) => `<tr>${th(row.label)}${sub ? td(row.sub) : ""}${count ? td(row.count, true) : ""}${row.cells.map((c) => td(c, true)).join("")}${td(row.total, true)}${td(row.share, true)}</tr>`)
    .join("");
  const title = t(r.pdfTitle, { scope: meta.scope });
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:11px;line-height:14px;color:#000000}
.muted{color:#595959}
table{width:100%;border-collapse:collapse}
th,td{padding:5px;border-bottom:2px solid #dddddd;text-align:left}
thead th{border-bottom:2px solid #000000;background:#fafafa}
tbody th{font-weight:700}
tfoot th,tfoot td{border-top:2px solid #000000;border-bottom:0;background:#fafafa;font-weight:700}
.num{text-align:right}
.detail{margin-top:20px}
.detail caption{text-align:left;font-weight:700;text-transform:uppercase;padding-bottom:5px}
</style></head><body>
${documentHeadHtml({ issuer: [doc.issuer, t(doc.division, { name: meta.division })], title: doc.reportTitle, facts: [[doc.number, meta.number], [doc.date, meta.date], [doc.period, view.period]], size: 11 })}
<div style="margin-top:20px">${partiesHtml([
    { label: doc.scope, html: `<b>${esc(meta.scope)}</b><br>${esc(doc.axis)} : ${esc(r.axes[axis])}` },
    { label: doc.issuedBy, html: `<b>${esc(meta.issuedBy)}</b><br><span class="muted">${esc(view.texts.capacity)}</span>` },
  ])}</div>
<table class="detail"><caption>${esc(r.detailTitle[axis])}</caption>
<thead><tr>${th(r.colEntity[axis])}${sub ? th(sub) : ""}${count ? th(count, true) : ""}${view.table.head.map((h) => th(h, true)).join("")}${th(r.colTotal, true)}${th(r.colShare, true)}</tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr>${th(r.total)}${sub ? "<td></td>" : ""}${count ? "<td></td>" : ""}${view.table.foot.cells.map((c) => td(c, true)).join("")}${td(view.table.foot.total, true)}${td(view.table.foot.share, true)}</tr></tfoot></table>
${summaryHtml([[r.fill, view.texts.fill], [r.validated, view.texts.validated], [r.entered, view.table.foot.total]])}
</body></html>`;
}
