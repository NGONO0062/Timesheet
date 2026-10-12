import { describe, expect, it } from "vitest";
import { auditHtml } from "../audit/exports";
import { documentHeadHtml, documentNumber, pdfFooterTemplate, summaryHtml, wordmarkHtml } from "./brand";

describe("documents exportés, mis en page comme une proforma", () => {
  it("le mot TimeSheet : « Time » en #f16e00, « Sheet » en blanc sur fond noir, en gras", () => {
    const html = wordmarkHtml(14);
    expect(html).toMatch(/background:#000000;color:#ffffff;/);
    expect(html).toContain("font-size:14px;");
    expect(html).toContain("font-weight:700;");
    expect(html).toContain('<span style="color:#f16e00">Time</span>Sheet</span>');
  });

  it("numéro de document : jour et heure d'édition à Douala (UTC+1)", () => {
    expect(documentNumber("RPT", new Date("2026-10-12T23:30:00Z"))).toBe("RPT-20261013-0030");
  });

  it("en-tête : émetteur à gauche, titre en capitales et cartouche à droite, texte échappé", () => {
    const html = documentHeadHtml({ issuer: ["Orange Cameroun", "Division R&D"], title: "Rapport d'activité", facts: [["N°", "RPT-1"], ["Date", "12/10/2026"]] });
    expect(html).toContain('<b style="font-weight:700">Orange Cameroun</b><br>Division R&amp;D');
    expect(html).toContain("text-transform:uppercase\">Rapport d'activité</div>");
    expect(html).toMatch(/>N°<\/td><td [^>]*>RPT-1<\/td><\/tr><tr>.*>Date<\/td><td [^>]*>12\/10\/2026<\/td>/);
    const mail = documentHeadHtml({ issuer: ["Orange Cameroun"], title: "Semaine 12 validée", facts: [], upper: false });
    expect(mail).not.toContain("uppercase");
    expect(mail).not.toContain("false");
  });

  it("récapitulatif : la dernière ligne en gras, sous un filet noir", () => {
    const html = summaryHtml([["Taux de remplissage", "94 %"], ["Heures saisies", "150 h"]]);
    expect(html).toContain('<tr><td style="border:0;background:#ffffff;padding:5px 10px;text-align:left">Taux de remplissage</td>');
    expect(html).toContain('<td style="border:0;border-top:2px solid #000000;background:#fafafa;font-weight:700;padding:5px 10px;text-align:left">Heures saisies</td>');
    expect(html).toContain('<div style="border:2px solid #000000;border-radius:6px;overflow:hidden">');
  });

  it("pied des PDF : mention à gauche, numéro de page Chromium à droite", () => {
    const html = pdfFooterTemplate("Interne Orange Cameroun · TimeSheet · RPT-1");
    expect(html).toContain("<span>Interne Orange Cameroun · TimeSheet · RPT-1</span>");
    expect(html).toContain('Page <span class="pageNumber"></span>/<span class="totalPages"></span>');
  });

  it("PDF du journal : en-tête, blocs, détail puis récapitulatif des résultats", () => {
    const at = new Date("2026-03-20T15:42:00Z");
    const row = { at, actor: "Paul Tchouta", actorRole: "OWNER" as const, division: "CX Expertise", action: "TIMESHEET_VALIDATED" as const, objectLabel: "S12", result: "SUCCESS" as const };
    const html = auditHtml([row, { ...row, result: "FAILURE" }], { period: "Du 01/03/2026 au 31/03/2026", issuedBy: "Admin Plateforme (Admin plateforme)", number: "JRN-20260401-0900", date: "01/04/2026" });
    const order = ["Journal d'audit</div>", "JRN-20260401-0900", "Administration de la plateforme", "Établi par", "<table class=\"detail\">", "Récapitulatif", "Événements"];
    let at0 = 0;
    for (const s of order) {
      const i = html.indexOf(s, at0);
      expect(i, s).toBeGreaterThan(-1);
      at0 = i;
    }
    expect(html).toMatch(/>Événements<\/td><td [^>]*>2<\/td>/);
  });
});
