import { describe, expect, it } from "vitest";
import { crc32, toCsv, toXlsx, zip } from "./table";

/** Lit une archive ZIP « stockée » : nom → contenu. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const out = new Map<string, string>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = dec.decode(bytes.slice(at + 30, at + 30 + nameLength));
    const data = bytes.slice(at + 30 + nameLength, at + 30 + nameLength + size);
    expect(crc32(data)).toBe(view.getUint32(at + 14, true));
    out.set(name, dec.decode(data));
    at += 30 + nameLength + size;
  }
  expect(view.getUint32(at, true)).toBe(0x02014b50); // répertoire central
  return out;
}

describe("exports", () => {
  it("écrit un CSV pour Excel en français", () => {
    const csv = toCsv([["Projet", "Total"], ["Refonte; parcours", 268.5], ['Dit "test"', null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿Projet;Total\r\n"Refonte; parcours";268,5\r\n"Dit ""test""";\r\n');
  });

  it("calcule le CRC32 standard", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("produit une archive ZIP lisible", () => {
    const files = unzip(zip([{ name: "a.txt", data: new TextEncoder().encode("bonjour é") }]));
    expect(files.get("a.txt")).toBe("bonjour é");
  });

  it("produit un classeur .xlsx avec nombres, textes échappés et en-tête en gras", () => {
    const files = unzip(toXlsx({ name: "Reporting", rows: [["Projet", "S10"], ["A & <B>", 98], ["C", null]] }));
    expect([...files.keys()]).toEqual(expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/styles.xml"]));
    const sheet = files.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Projet</t></is></c>');
    expect(sheet).toContain('<c r="B2"><v>98</v></c>');
    expect(sheet).toContain("A &amp; &lt;B&gt;");
    expect(files.get("xl/workbook.xml")).toContain('name="Reporting"');
  });
});
