// Gabarit de la feuille (.ts-sheet, écran 06) : le même HTML sert à l'aperçu et au
// PDF (PROMPT.md §11.4). Pur, tout le texte est échappé.
import { dict } from "../i18n";
import { SHEET_TEMPLATE } from "./config";
import type { InternshipKind, SheetBlock, SheetModel } from "./sheet";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Signature du superviseur, imprimée dans la case prévue. */
export type PrintedSignature = { name: string; drawing?: string | null; note: string };

const KINDS: Array<[InternshipKind, string]> = [
  ["ACADEMIC", dict.attendance.kinds.ACADEMIC],
  ["PROFESSIONAL", dict.attendance.kinds.PROFESSIONAL],
  ["GRADUATE", dict.attendance.kinds.GRADUATE],
];

function box(checked: boolean) {
  const label = checked ? dict.attendance.checked : dict.attendance.unchecked;
  return `<span class="ts-box${checked ? " is-checked" : ""}" role="img" aria-label="${escape(label)}"></span>`;
}

function block(b: SheetBlock) {
  const rows = b.rows.map((r) => `<tr><td>${escape(r.label)}</td><td>${escape(r.arrival)}</td><td>${escape(r.departure)}</td></tr>`).join("");
  return `<table><thead><tr><td></td><td>${escape(dict.attendance.arrival)}</td><td>${escape(dict.attendance.departure)}</td></tr></thead><tbody>${rows}</tbody></table>`;
}

function signatureCell(s: PrintedSignature | null) {
  if (!s) return "";
  const drawing = s.drawing
    ? `<svg width="120" height="40" viewBox="0 0 300 100" fill="none" aria-hidden="true"><path d="${escape(s.drawing)}" stroke="#000000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : "";
  return `<span style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${escape(s.name)}${drawing}<span style="font-weight:400">${escape(s.note)}</span></span>`;
}

/** La feuille seule, avec les classes .ts-sheet* de la feuille de styles. */
export function sheetHtml(m: SheetModel, signature: PrintedSignature | null = null): string {
  const a = dict.attendance;
  const T = SHEET_TEMPLATE;
  return [
    `<div class="ts-sheet">`,
    `<table class="ts-sheet-head"><tbody>`,
    `<tr><td style="width:160px"><span class="logo-slot on-light" role="img" aria-label="${escape(a.logoSlot)}" style="width:20px;height:20px"></span></td><td colspan="3" style="text-align:center">${escape(T.title)}</td></tr>`,
    `<tr><td>${escape(T.reference)}</td><td style="width:140px;text-align:left">${escape(a.version)} : ${escape(T.version)}</td><td></td><td style="width:240px;text-align:left">${escape(a.updatedOn)} : ${escape(T.updatedOn)}</td></tr>`,
    `</tbody></table>`,
    `<p class="ts-sheet-line"><span>${escape(a.internName)} : <b>${escape(m.name)}</b></span></p>`,
    `<p class="ts-sheet-line"><span>${escape(a.kind)} :</span>${KINDS.map(([k, label]) => `<span>${escape(label)} ${box(m.kind === k)}</span>`).join("")}</p>`,
    `<p class="ts-sheet-line"><span>${escape(a.entity)} :</span><span>${escape(a.direction)} : <b>${escape(m.direction)}</b></span><span>${escape(a.department)} : <b>${escape(m.department)}</b></span><span>${escape(a.service)} : <b>${escape(m.service)}</b></span></p>`,
    `<p class="ts-sheet-line"><span>${escape(a.periodLabel)} :</span><span>${escape(a.from)} <b>${escape(m.from)}</b></span><span>${escape(a.to)} <b>${escape(m.to)}</b></span></p>`,
    `<div class="ts-sheet-weeks">`,
    ...m.blocks.map(block),
    `<div></div>`,
    `<div class="ts-sheet-bottom">`,
    `<p class="ts-sheet-line" style="gap:10px"><span>${escape(a.absenceDays)} :</span><span class="ts-sheet-field" style="width:120px">${m.absenceDays}</span></p>`,
    `<p>${escape(a.observation)} :</p>`,
    `<div class="ts-sheet-field" style="min-height:60px">${escape(m.observation)}</div>`,
    `<p class="ts-sheet-line" style="gap:10px;flex-wrap:nowrap"><span style="white-space:nowrap">${escape(a.supervisorSignature)} :</span><span class="ts-sheet-field" style="flex:1 1 0%;min-height:30px">${signatureCell(signature)}</span></p>`,
    `</div>`,
    `</div>`,
    `<div class="ts-sheet-foot"><span>${escape(T.footer)}</span><span>${escape(T.page)}</span></div>`,
    `</div>`,
  ].join("");
}

// Styles de la feuille pour le PDF : ceux de styles/timesheet.css (.ts-sheet*), sans
// le cadre d'aperçu. Imprimé par Chromium côté serveur, sans ressource distante.
const SHEET_CSS = [
  `@page{size:A4 landscape;margin:0}`,
  `*{box-sizing:border-box}`,
  `body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#000;background:#fff}`,
  `p{margin:0}`,
  `.ts-sheet{display:flex;flex-direction:column;gap:10px;width:297mm;height:210mm;padding:12mm 15mm;background:#fff;font-size:12px;line-height:14px}`,
  `.ts-sheet table{width:100%;border-collapse:collapse}`,
  `.ts-sheet td{height:18px;padding:0 5px;border:2px solid #000;text-align:center}`,
  `.ts-sheet td:first-child{text-align:left}`,
  `.ts-sheet thead td{border:0}`,
  `.ts-sheet-head td{height:26px}`,
  `.ts-sheet-line{display:flex;flex-wrap:wrap;align-items:center;gap:5px 20px}`,
  `.ts-sheet-line b{font-weight:700}`,
  `.ts-sheet-weeks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 30px}`,
  `.ts-box{position:relative;display:inline-block;width:12px;height:12px;border:2px solid #000;vertical-align:-2px}`,
  `.ts-box.is-checked::after{content:"";position:absolute;inset:0;background:#000;clip-path:polygon(20% 10%,50% 40%,80% 10%,90% 20%,60% 50%,90% 80%,80% 90%,50% 60%,20% 90%,10% 80%,40% 50%,10% 20%)}`,
  `.ts-sheet-bottom{grid-column:2 / -1;display:flex;flex-direction:column;gap:10px;padding:10px;border:2px solid #000}`,
  `.ts-sheet-field{display:inline-flex;align-items:center;min-height:20px;padding:0 5px;border:2px solid #000;font-weight:700}`,
  `.ts-sheet-foot{display:flex;justify-content:space-between;gap:20px;margin-top:auto;padding-top:5px;border-top:2px solid #000}`,
  `.logo-slot{display:inline-flex;border:2px dashed #000}`,
].join("");

/** Document autonome pour l'impression PDF (A4 paysage, une page). */
export function sheetDocument(m: SheetModel, signature: PrintedSignature | null, title: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${SHEET_CSS}</style></head><body>${sheetHtml(m, signature)}</body></html>`;
}
