import { describe, expect, it } from "vitest";
import { auditHtml } from "../audit/exports";
import { brandBandHtml, wordmarkHtml } from "./brand";

describe("mot TimeSheet des documents exportés", () => {
  it("« Time » en #f16e00, « Sheet » en blanc sur fond noir, en gras", () => {
    const html = wordmarkHtml(14);
    expect(html).toMatch(/background:#000000;color:#ffffff;/);
    expect(html).toContain("font-size:14px;");
    expect(html).toContain("font-weight:700;");
    expect(html).toContain('<span style="color:#f16e00">Time</span>Sheet</span>');
  });

  it("le PDF du journal s'ouvre sur le bandeau, avant le titre", () => {
    const html = auditHtml([], { period: "Du 1er au 31 mars 2026", generated: "Généré le 1er avril 2026" });
    expect(html).toContain(`<body>\n${brandBandHtml()}\n<h1>`);
  });
});
