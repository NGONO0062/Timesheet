// Documents qui sortent de l'application (e-mails, PDF, Excel), mis en page comme une
// facture proforma : émetteur et cartouche (titre, numéro, date), blocs d'information,
// contenu, récapitulatif, pied. Pas de logo (PROMPT.md §1) : le mot TimeSheet, « Time »
// en #f16e00, « Sheet » en blanc sur fond noir. HTML en styles en ligne : les messageries
// et l'impression PDF n'ont pas timesheet.css. Purs, tout le texte est échappé.
import { formatFrDate, formatTime, zonedDay } from "../format";
import { dict } from "../i18n";

export const BRAND = { black: "#000000", time: "#f16e00", sheet: "#ffffff" } as const;

const d = dict.document;
const FONT = `font-family:'Helvetica Neue',Helvetica,Arial,sans-serif`;
// Cellule neutre : annule les bordures et hauteurs des tableaux du gabarit qui l'entoure.
const CELL = "border:0;height:auto;padding:0;vertical-align:top";

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Le mot seul, sur fond noir : `size` en pixels (texte de 14 à 24). */
export function wordmarkHtml(size = 20): string {
  return [
    `<span style="display:inline-block;padding:5px 10px;border-radius:6px;background:${BRAND.black};color:${BRAND.sheet};`,
    `${FONT};font-size:${size}px;line-height:${size + 2}px;font-weight:700;letter-spacing:-.5px;white-space:nowrap">`,
    `<span style="color:${BRAND.time}">${dict.app.wordTime}</span>${dict.app.wordSheet}</span>`,
  ].join("");
}

/** Numéro de document : préfixe, jour et heure d'édition dans le fuseau de la division. « RPT-20261012-1542 ». */
export function documentNumber(prefix: string, at: Date): string {
  const [day, month, year] = formatFrDate(zonedDay(at)).split("/");
  return `${prefix}-${year}${month}${day}-${formatTime(at).replace(":", "")}`;
}

export type DocumentHead = {
  /** Lignes sous le mot TimeSheet : la première en gras (l'émetteur). */
  issuer: string[];
  title: string;
  /** Cartouche : libellé et valeur (N°, Date, Période…). */
  facts: Array<[string, string]>;
  /** Taille du texte de base, en pixels (10 ou 11 pour un PDF dense, 14 pour un e-mail). */
  size?: number;
  /** Titre en capitales (défaut) ; un objet d'e-mail garde sa casse. */
  upper?: boolean;
};

/** En-tête : émetteur à gauche, cartouche à droite, filet noir dessous. Un tableau : lu par toutes les messageries. */
export function documentHeadHtml(h: DocumentHead): string {
  const size = h.size ?? 12;
  const issuer = h.issuer.map((line, i) => (i === 0 ? `<b style="font-weight:700">${escapeHtml(line)}</b>` : escapeHtml(line))).join("<br>");
  const facts = h.facts
    .map(([label, value]) => `<tr><td style="${CELL};padding:0 10px 0 0;text-align:right;color:#595959">${escapeHtml(label)}</td><td style="${CELL};text-align:right;font-weight:700">${escapeHtml(value)}</td></tr>`)
    .join("");
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0;${FONT};font-size:${size}px;line-height:${size + 4}px;color:#000000">`,
    `<tr><td style="${CELL};text-align:left;padding:0 20px 10px 0;border-bottom:2px solid #000000">${wordmarkHtml(size + 8)}<div style="margin-top:10px">${issuer}</div></td>`,
    `<td style="${CELL};text-align:right;padding:0 0 10px;border-bottom:2px solid #000000">`,
    `<div style="font-size:${size + 8}px;line-height:${size + 10}px;font-weight:700${h.upper === false ? "" : ";text-transform:uppercase"}">${escapeHtml(h.title)}</div>`,
    facts ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:10px 0 0 auto;width:auto">${facts}</table>` : "",
    `</td></tr></table>`,
  ].join("");
}

/** Blocs d'information côte à côte (périmètre, établi par…) : libellé en capitales, contenu HTML déjà échappé. */
export function partiesHtml(parties: Array<{ label: string; html: string }>, gap = 20): string {
  const blocks = parties
    .map((p) => `<div style="flex:1 1 0%;min-width:0;padding:10px;border:2px solid #000000;border-radius:6px"><div style="margin-bottom:5px;color:#595959;font-weight:700;text-transform:uppercase">${escapeHtml(p.label)}</div>${p.html}</div>`)
    .join("");
  return `<div style="display:flex;gap:${gap}px">${blocks}</div>`;
}

/** Récapitulatif aligné à droite : la dernière ligne en gras, sur fond #fafafa, filet noir au-dessus. */
export function summaryHtml(rows: Array<[string, string]>, title: string = d.summary): string {
  const last = rows.length - 1;
  // Bordures en ligne sur chaque cellule : les styles du document qui l'entoure ne s'y appliquent pas.
  const body = rows
    .map(([label, value], i) => {
      const cell = i === last ? "border:0;border-top:2px solid #000000;background:#fafafa;font-weight:700" : "border:0;background:#ffffff";
      return `<tr><td style="${cell};padding:5px 10px;text-align:left">${escapeHtml(label)}</td><td style="${cell};padding:5px 10px;text-align:right;white-space:nowrap">${escapeHtml(value)}</td></tr>`;
    })
    .join("");
  return [
    `<div style="width:320px;margin:20px 0 0 auto">`,
    `<div style="padding:0 0 5px;font-weight:700;text-transform:uppercase">${escapeHtml(title)}</div>`,
    `<div style="border:2px solid #000000;border-radius:6px;overflow:hidden">`,
    `<table style="width:100%;margin:0;border-collapse:collapse"><tbody>${body}</tbody></table></div></div>`,
  ].join("");
}

/** Pied de page des PDF (gabarit Chromium) : mention et numéro à gauche, « Page n/N » à droite. */
export function pdfFooterTemplate(left: string): string {
  return [
    `<div style="width:100%;margin:0 15mm;padding-top:5px;border-top:2px solid #000000;display:flex;justify-content:space-between;${FONT};font-size:9px;line-height:11px;color:#000000">`,
    `<span>${escapeHtml(left)}</span>`,
    `<span>${d.page} <span class="pageNumber"></span>/<span class="totalPages"></span></span>`,
    `</div>`,
  ].join("");
}
