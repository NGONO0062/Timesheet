// Le mot TimeSheet sur les documents qui sortent de l'application (e-mails, PDF, Excel).
// Pas de logo (PROMPT.md §1) : « Time » en #f16e00, « Sheet » en blanc, sur fond noir.
// HTML en styles en ligne : les messageries et l'impression PDF n'ont pas timesheet.css.
import { dict } from "../i18n";

export const BRAND = { black: "#000000", time: "#f16e00", sheet: "#ffffff" } as const;

/** Le mot seul, sur fond noir : `size` en pixels (texte de 14 à 24). */
export function wordmarkHtml(size = 20): string {
  return [
    `<span style="display:inline-block;padding:5px 10px;border-radius:6px;background:${BRAND.black};color:${BRAND.sheet};`,
    `font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:${size}px;line-height:${size + 2}px;font-weight:700;letter-spacing:-.5px;white-space:nowrap">`,
    `<span style="color:${BRAND.time}">${dict.app.wordTime}</span>${dict.app.wordSheet}</span>`,
  ].join("");
}

/** Bandeau noir en tête de document : le mot TimeSheet à gauche. */
export function brandBandHtml(): string {
  return [
    `<div style="margin:0 0 20px;padding:10px 20px;background:${BRAND.black};border-radius:6px">`,
    wordmarkHtml(20),
    `</div>`,
  ].join("");
}

/** Bandeau des e-mails : un tableau, seule mise en page que toutes les messageries respectent. */
export function mailBandHtml(): string {
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px">`,
    `<tr><td style="padding:20px;background:${BRAND.black};border-radius:6px">${wordmarkHtml(24)}</td></tr></table>`,
  ].join("");
}
