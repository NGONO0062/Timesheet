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
export async function htmlToPdf(html: string, options: { landscape?: boolean } = {}): Promise<Uint8Array> {
  const context = await (await shared()).newContext({ javaScriptEnabled: false, offline: true });
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: options.landscape ?? false,
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    return new Uint8Array(pdf);
  } finally {
    await context.close();
  }
}
