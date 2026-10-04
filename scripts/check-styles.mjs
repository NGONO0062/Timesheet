#!/usr/bin/env node
// Contrôle de style (PROMPT.md §4.2). Échoue sur :
//   - border*: 1px
//   - font-weight autre que 400 / 700
//   - opacity autre que 0 ou 1
//   - gradient(
//   - box-shadow hors anneau de focus
//   - border-radius > 8 px
//   - couleur hors palette (séries de graphiques admises dans .chart-s1 à .chart-s4 seulement)
// Analyse les feuilles CSS de l'application et les styles en ligne des composants.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["styles", "app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", "design"]);

const PALETTE = new Set([
  "#ff7900", "#f16e00", "#000000", "#ffffff", "#999999", "#595959",
  "#dddddd", "#fafafa", "#228722", "#cd3c14", "#ffd200", "#4170d8",
]);
const SERIES = new Set(["#237eca", "#198c51", "#6e4aa7", "#d573bb"]);
const FOCUS_RING = /^0 0 0 2px #fff(fff)?$/i;
const BACKDROP = /^rgba\(0, ?0, ?0, ?(\.5|0\.5)\)$/;

function expandHex(hex) {
  const h = hex.toLowerCase();
  if (h.length === 4) return "#" + [...h.slice(1)].map((c) => c + c).join("");
  return h;
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(css|tsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

const problems = [];
const report = (file, line, msg) => problems.push(`${path.relative(ROOT, file)}:${line}  ${msg}`);

function checkDeclaration(file, line, selector, prop, value) {
  prop = prop.trim().toLowerCase();
  value = value.trim().replace(/\s*!important$/, "");
  const v = value.toLowerCase();

  if (prop.startsWith("border") && !prop.includes("radius") && /(^|[\s(])1px\b/.test(v)) {
    report(file, line, `bordure de 1 px interdite (${prop}: ${value})`);
  }
  if (prop === "font-weight" && !["400", "700", "normal", "bold", "inherit"].includes(v)) {
    report(file, line, `graisse ${value} interdite (400 ou 700)`);
  }
  if (prop === "opacity" && !["0", "1"].includes(v)) {
    report(file, line, `opacité ${value} interdite (0 ou 1)`);
  }
  if (v.includes("gradient(")) {
    report(file, line, `dégradé interdit (${prop})`);
  }
  if (prop === "box-shadow" && v !== "none" && !FOCUS_RING.test(v)) {
    report(file, line, `ombre interdite (${value}) : seul l'anneau de focus est admis`);
  }
  if (prop.includes("radius")) {
    for (const m of v.matchAll(/(\d+(?:\.\d+)?)px/g)) {
      if (Number(m[1]) > 8) report(file, line, `rayon ${m[0]} supérieur à 8 px`);
    }
  }
  for (const m of v.matchAll(/#[0-9a-f]{3,8}\b/g)) {
    const hex = expandHex(m[0]);
    if (PALETTE.has(hex)) continue;
    if (SERIES.has(hex)) {
      if (!/\.chart-s[1-4]\b/.test(selector)) report(file, line, `couleur de série ${m[0]} hors des règles .chart-s1 à .chart-s4`);
      continue;
    }
    report(file, line, `couleur ${m[0]} hors palette`);
  }
  for (const m of v.matchAll(/rgba?\([^)]*\)|hsla?\([^)]*\)/g)) {
    if (BACKDROP.test(m[0]) && /backdrop/.test(selector)) continue;
    report(file, line, `couleur ${m[0]} interdite (voile de modale seulement : rgba(0,0,0,.5))`);
  }
}

function checkCss(file, text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of clean.matchAll(rule)) {
    const selector = m[1].trim();
    const bodyStart = m.index + m[1].length + 1;
    let offset = 0;
    for (const decl of m[2].split(";")) {
      const colon = decl.indexOf(":");
      if (colon > 0) {
        const lead = decl.length - decl.trimStart().length;
        checkDeclaration(file, lineOf(clean, bodyStart + offset + lead), selector, decl.slice(0, colon), decl.slice(colon + 1));
      }
      offset += decl.length + 1;
    }
  }
}

// Styles en ligne dans les composants : style={{ fontWeight: 600, color: "#123456" }}
const INLINE = /\b(fontWeight|opacity|boxShadow|borderRadius|border\w*|color|background\w*)\s*:\s*("[^"]*"|'[^']*'|[\d.]+)/g;
const TO_CSS = { fontWeight: "font-weight", opacity: "opacity", boxShadow: "box-shadow", borderRadius: "border-radius" };

function checkTs(file, text) {
  for (const m of text.matchAll(INLINE)) {
    const key = m[1];
    const raw = m[2].replace(/^["']|["']$/g, "");
    const prop = TO_CSS[key] ?? key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    const value = key === "borderRadius" && /^\d+$/.test(raw) ? raw + "px" : raw;
    checkDeclaration(file, lineOf(text, m.index), "", prop, value);
  }
}

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d), []));
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".css")) checkCss(file, text);
  else checkTs(file, text);
}

if (problems.length) {
  console.error(`Contrôle de style : ${problems.length} problème(s)\n`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`Contrôle de style : ${files.length} fichier(s), aucun problème.`);
