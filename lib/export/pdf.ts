import "server-only";
// PDF (PROMPT.md §3) : un gabarit HTML imprimé côté serveur par Chromium (Playwright).
// Le même mécanisme servira à la fiche de présence RH (jalon 5).
import { chromium, type Browser } from "playwright-core";

let browser: Promise<Browser> | null = null;

function shared(): Promise<Browser> {
  browser ??= chromium.launch({ headless: true }).catch((e: unknown) => {
    browser = null;
    throw e;
  });
  return browser;
}

/** Imprime un document HTML autonome (styles en ligne, aucun script, aucune ressource distante). */
/** `footer` : gabarit du pied répété sur chaque page (pdfFooterTemplate de lib/export/brand.ts). */
export async function htmlToPdf(html: string, options: { landscape?: boolean; fullBleed?: boolean; footer?: string } = {}): Promise<Uint8Array> {
  const context = await (await shared()).newContext({ javaScriptEnabled: false, offline: true });
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: options.landscape ?? false,
      printBackground: true,
      // Pleine page : le gabarit fixe lui-même ses marges (fiche de présence).
      margin: options.fullBleed ? { top: "0", right: "0", bottom: "0", left: "0" } : { top: "15mm", right: "15mm", bottom: "20mm", left: "15mm" },
      displayHeaderFooter: Boolean(options.footer),
      headerTemplate: "<span></span>",
      footerTemplate: options.footer ?? "<span></span>",
      preferCSSPageSize: options.fullBleed ?? false,
    });
    return new Uint8Array(pdf);
  } finally {
    await context.close();
  }
}
