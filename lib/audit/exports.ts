// Exports du journal d'audit (PROMPT.md §9.10) : mêmes colonnes que l'écran, mêmes
// filtres. Purs : la route d'export fournit les lignes.
import type { Cell } from "../export/table";
import { formatDateTime } from "../format";
import { dict } from "../i18n";
import type { Role } from "../permissions";
import { statusLook } from "../status";
import { roleLabel } from "../viewer";
import type { AuditAction } from "./catalog";

const au = dict.audit;

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

/** Document HTML imprimé en PDF (A4 paysage). */
export function auditHtml(rows: AuditExportRow[], meta: { period: string; generated: string }): string {
  const body = rows.map((r) => `<tr>${cells(r).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(au.pdfTitle)}</title><style>
body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:10px;line-height:13px;color:#000000}
h1{margin:0 0 5px;font-size:20px;line-height:22px;font-weight:700}
.muted{color:#595959}
table{width:100%;margin-top:20px;border-collapse:collapse}
th,td{padding:5px;border-bottom:2px solid #dddddd;text-align:left;vertical-align:top}
thead th{border-bottom:2px solid #000000}
footer{margin-top:20px;color:#595959}
</style></head><body>
<h1>${esc(au.pdfTitle)}</h1>
<div class="muted">${esc(meta.period)}</div>
<table><thead><tr>${HEAD().map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
<footer>${esc(meta.generated)} · ${esc(dict.mail.signature)}</footer>
</body></html>`;
}
