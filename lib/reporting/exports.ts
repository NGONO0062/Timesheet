// Exports du reporting (PROMPT.md §9.5) : mêmes données que l'écran, même ordre.
// Purs : la route d'export fournit le modèle de vue.
import type { Cell } from "../export/table";
import { dict, t } from "../i18n";
import type { ReportView } from "./view";

const r = dict.reporting;

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

/** Document HTML imprimé en PDF : titre, période, indicateurs, tableau de détail. */
export function reportHtml(view: ReportView, meta: { scope: string; generated: string }): string {
  const axis = view.params.axis;
  const sub = r.colSub[axis];
  const count = r.colCount[axis];
  const th = (s: string, num = false) => `<th${num ? ' class="num"' : ""}>${esc(s)}</th>`;
  const td = (s: string | number, num = false) => `<td${num ? ' class="num"' : ""}>${esc(String(s))}</td>`;
  const rows = view.table.rows
    .map((row) => `<tr>${th(row.label)}${sub ? td(row.sub) : ""}${count ? td(row.count, true) : ""}${row.cells.map((c) => td(c, true)).join("")}${td(row.total, true)}${td(row.share, true)}</tr>`)
    .join("");
  const kpi = (label: string, value: string, detail: string) => `<div class="kpi"><div class="muted">${esc(label)}</div><div class="big">${esc(value)}</div><div>${esc(detail)}</div></div>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(t(r.pdfTitle, { scope: meta.scope }))}</title><style>
body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:11px;line-height:14px;color:#000000}
h1{margin:0 0 5px;font-size:20px;line-height:22px;font-weight:700}
.muted{color:#595959}
.kpis{display:flex;gap:10px;margin:20px 0}
.kpi{flex:1;padding:10px;border:2px solid #999999;border-radius:6px}
.big{font-size:18px;line-height:20px;font-weight:700;margin:5px 0}
table{width:100%;border-collapse:collapse}
th,td{padding:5px;border-bottom:2px solid #dddddd;text-align:left}
thead th{border-bottom:2px solid #000000}
tbody th{font-weight:700}
tfoot th,tfoot td{border-top:2px solid #000000;border-bottom:0;background:#fafafa;font-weight:700}
.num{text-align:right}
footer{margin-top:20px;color:#595959}
</style></head><body>
<h1>${esc(t(r.pdfTitle, { scope: meta.scope }))}</h1>
<div class="muted">${esc(view.period)} · ${esc(r.axes[axis])}</div>
<div class="kpis">${kpi(r.entered, view.table.foot.total, view.texts.capacity)}${kpi(r.fill, view.texts.fill, view.texts.fillDetail)}${kpi(r.validated, view.texts.validated, view.texts.validatedDetail)}</div>
<table><caption style="text-align:left;font-weight:700;padding-bottom:5px">${esc(r.detailTitle[axis])}</caption>
<thead><tr>${th(r.colEntity[axis])}${sub ? th(sub) : ""}${count ? th(count, true) : ""}${view.table.head.map((h) => th(h, true)).join("")}${th(r.colTotal, true)}${th(r.colShare, true)}</tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr>${th(r.total)}${sub ? "<td></td>" : ""}${count ? "<td></td>" : ""}${view.table.foot.cells.map((c) => td(c, true)).join("")}${td(view.table.foot.total, true)}${td(view.table.foot.share, true)}</tr></tfoot></table>
<footer>${esc(meta.generated)} · ${esc(dict.mail.signature)}</footer>
</body></html>`;
}
