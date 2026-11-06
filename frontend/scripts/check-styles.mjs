// Contrôle de style (CLAUDE.md, « Règles à ne jamais enfreindre »), version Tailwind.
// Le thème (src/app/styles/index.css) ne définit que les valeurs permises ; ce
// contrôle ferme ce que le thème ne peut pas fermer : valeurs arbitraires,
// bordures de 1 px, opacités, dégradés, couleurs écrites en dur, styles en ligne.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const THEME = "src/app/styles/index.css";

/** Classes Tailwind interdites, avec la raison affichée. */
const CLASS_RULES = [
  [/^(?:[\w-]+:)*!?-?[\w-]*-\[.+\]$/, "valeur arbitraire : ajoutez un jeton nommé au thème"],
  [/^(?:[\w-]+:)*-?[\w-]+-\(.+\)$/, "variable arbitraire : ajoutez un jeton nommé au thème"],
  [/^(?:[\w-]+:)*border(?:-[trblxyse])?$/, "bordure de 1 px : utilisez border-2"],
  [/^(?:[\w-]+:)*border(?:-[trblxyse])?-(?!0$|2$)\d+$/, "bordure : 2 px seulement"],
  [/^(?:[\w-]+:)*(?:divide|outline|ring)(?:-[xy])?-(?!0$|2$)\d+$/, "épaisseur : 2 px seulement"],
  [/^(?:[\w-]+:)*opacity-\d+$/, "opacité réduite interdite"],
  [/^(?:[\w-]+:)*bg-(?:linear|radial|conic|gradient)/, "dégradé interdit"],
  [/^(?:[\w-]+:)*(?:from|via|to)-[a-z]/, "dégradé interdit"],
  [/^(?:[\w-]+:)*font-(?:thin|extralight|light|medium|semibold|extrabold|black)$/, "graisses 400 et 700 seulement"],
  [/^(?:[\w-]+:)*rounded(?:-[trblse]{1,2})?-(?:xl|2xl|3xl|4xl|full)$/, "rayon de 8 px au maximum"],
];

/** Une couleur avec opacité (bg-black/50) : seul le voile de modale est permis. */
const OPACITY_MODIFIER = /^(?:[\w-]+:)*[\w-]+\/\d+$/;
const MODAL_BACKDROP = "bg-black/50";

const CHART_CLASS = /(?:^|:)[\w-]+-chart-[1-4]$/;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const CSS_WEIGHT = /font-weight\s*:\s*(?!400\b|700\b|inherit\b)[^;}\s]+/;

/** Chaînes du fichier (guillemets et gabarits) découpées en mots. */
function classTokens(text) {
  const tokens = [];
  const strings = text.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g);
  for (const [, , body] of strings) {
    for (const t of body.split(/[\s]+/)) if (t) tokens.push(t.replace(/\$\{.*$/, ""));
  }
  return tokens;
}

/** Problèmes d'un fichier : liste de « raison : extrait ». */
export function checkSource(path, text) {
  const problems = [];
  const isChart = /(^|[/\\])charts?([/\\]|$)|Chart/.test(path);

  if (/\.css$/.test(path)) {
    if (path.replaceAll(sep, "/").endsWith(THEME)) return problems;
    if (HEX.test(text)) problems.push(`couleur en dur : utilisez le thème (${text.match(HEX)[0]})`);
    if (CSS_WEIGHT.test(text)) problems.push(`graisse : 400 et 700 seulement (${text.match(CSS_WEIGHT)[0]})`);
    if (/box-shadow\s*:(?!\s*none)/.test(text)) problems.push("ombre interdite");
    if (/gradient\(/.test(text)) problems.push("dégradé interdit");
    return problems;
  }

  if (/style=\{\{/.test(text)) problems.push("style en ligne : utilisez des classes du thème");
  const hex = text.match(HEX);
  if (hex) problems.push(`couleur en dur : utilisez le thème (${hex[0]})`);

  for (const token of new Set(classTokens(text))) {
    for (const [rule, reason] of CLASS_RULES) if (rule.test(token)) problems.push(`${reason} (${token})`);
    if (OPACITY_MODIFIER.test(token) && token.replace(/^(?:[\w-]+:)*/, "") !== MODAL_BACKDROP && /^(?:[\w-]+:)*(?:bg|text|border|ring|outline|fill|stroke|divide|decoration|placeholder|caret|accent)-/.test(token)) {
      problems.push(`opacité réduite interdite, sauf le voile de modale (${token})`);
    }
    if (CHART_CLASS.test(token) && !isChart) problems.push(`couleur de série hors d'un graphique (${token})`);
  }
  return problems;
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const list = files(join(root, "src"));
  let count = 0;
  for (const file of list) {
    for (const p of checkSource(relative(root, file), readFileSync(file, "utf8"))) {
      console.error(`${relative(root, file)} : ${p}`);
      count++;
    }
  }
  if (count) {
    console.error(`Contrôle de style : ${count} problème(s).`);
    process.exit(1);
  }
  console.log(`Contrôle de style : ${list.length} fichier(s), aucun problème.`);
}
