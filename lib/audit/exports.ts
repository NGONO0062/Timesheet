// Exports du journal d'audit (PROMPT.md §9.10) : mêmes colonnes que l'écran, mêmes
// filtres. Purs : la route d'export fournit les lignes.
import { documentHeadHtml, partiesHtml, summaryHtml } from "../export/brand";
import type { Cell } from "../export/table";
import { formatDateTime } from "../format";
import { dict } from "../i18n";
import type { Role } from "../permissions";
import { statusLook } from "../status";
import { roleLabel } from "../viewer";
import type { AuditAction } from "./catalog";

const au = dict.audit;
const doc = dict.document;

export type AuditExportRow = {
  at: Date;
  actor: string | null;
  actorRole: Role | null;
  division: string | null;
  action: AuditAction;
  objectLabel: string;
  result: "SUCCESS" | "FAILURE";
};

const cells = (r: AuditExportRow): string[] => [
  formatDateTime(r.at, true),
  r.actor ?? au.unknownActor,
  r.actorRole ? roleLabel(r.actorRole) : "",
  r.division ?? au.noDivision,
  au.actions[r.action],
  r.objectLabel,
  statusLook("audit", r.result).label,
];

const HEAD = () => [au.colAt, au.colActor, dict.admin.colRole, au.colDivision, au.colAction, au.colObject, au.colResult];

export function auditRows(rows: AuditExportRow[]): Cell[][] {
  return [HEAD(), ...rows.map(cells)];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** En-tête du PDF : période, auteur, numéro et date d'édition (la route les fournit). */
export type AuditPdfMeta = { period: string; issuedBy: string; number: string; date: string };

/** Document HTML imprimé en PDF (A4 paysage), mis en page comme une proforma. */
export function auditHtml(rows: AuditExportRow[], meta: AuditPdfMeta): string {
  const body = rows.map((r) => `<tr>${cells(r).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  const failures = rows.filter((r) => r.result === "FAILURE").length;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(au.pdfTitle)}</title><style>
body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:10px;line-height:13px;color:#000000}
.muted{color:#595959}
table.detail{width:100%;margin-top:20px;border-collapse:collapse}
.detail th,.detail td{padding:5px;border-bottom:2px solid #dddddd;text-align:left;vertical-align:top}
.detail thead th{border-bottom:2px solid #000000;background:#fafafa}
</style></head><body>
${documentHeadHtml({ issuer: [doc.issuer, doc.platform], title: doc.auditTitle, facts: [[doc.number, meta.number], [doc.date, meta.date], [doc.period, meta.period]], size: 10 })}
<div style="margin-top:20px">${partiesHtml([
    { label: doc.scope, html: `<b>${esc(doc.platform)}</b><br><span class="muted">${esc(meta.period)}</span>` },
    { label: doc.issuedBy, html: `<b>${esc(meta.issuedBy)}</b>` },
  ])}</div>
<table class="detail"><thead><tr>${HEAD().map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
${summaryHtml([[statusLook("audit", "SUCCESS").label, String(rows.length - failures)], [statusLook("audit", "FAILURE").label, String(failures)], [doc.auditCount, String(rows.length)]])}
</body></html>`;
}
