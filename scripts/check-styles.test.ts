import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(import.meta.dirname, "check-styles.mjs");
const dirs: string[] = [];

/** Lance le contrôle sur un dossier temporaire contenant les fichiers donnés. */
function check(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-styles-"));
  dirs.push(root);
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  const r = spawnSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
  return { ok: r.status === 0, output: r.stdout + r.stderr };
}

afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe("contrôle de style (§4.2)", () => {
  it("admet les couleurs de séries dans .chart-s1 à .chart-s4", () => {
    const r = check({
      "styles/a.css": ".chart-s1{--c:#237eca}\n.chart-s2{--c:#198c51}\n.chart-s3{--c:#6e4aa7}\n.chart-s4{--c:#d573bb}\n",
    });
    expect(r.output).toContain("aucun problème");
    expect(r.ok).toBe(true);
  });

  it.each(["#237eca", "#198c51", "#6e4aa7", "#d573bb"])("refuse %s hors des règles de séries", (color) => {
    const r = check({ "styles/a.css": `.chart-bar{background:${color}}\n.badge{color:${color}}\n` });
    expect(r.ok).toBe(false);
    expect(r.output.match(/couleur de série/g)).toHaveLength(2);
  });

  it("refuse une couleur de série en style en ligne", () => {
    const r = check({ "components/A.tsx": 'export const A = () => <span style={{ color: "#237eca" }} />;\n' });
    expect(r.ok).toBe(false);
    expect(r.output).toContain("couleur de série #237eca");
  });

  it("refuse 1 px, graisses 500 / 600, opacité, dégradé, ombre, grand rayon, couleur hors palette", () => {
    const r = check({
      "styles/a.css":
        ".a{border:1px solid #000;font-weight:600;opacity:.4;background:linear-gradient(#fff,#000);box-shadow:0 2px 4px #000;border-radius:12px;color:#123456}\n",
    });
    expect(r.ok).toBe(false);
    for (const msg of ["1 px", "graisse 600", "opacité .4", "dégradé", "ombre", "rayon 12px", "#123456 hors palette"]) {
      expect(r.output).toContain(msg);
    }
  });

  it("admet l'anneau de focus et le voile de modale", () => {
    const r = check({
      "styles/a.css": "a:focus-visible{box-shadow:0 0 0 2px #fff}\n.modal-backdrop{background:rgba(0,0,0,.5)}\n",
    });
    expect(r.ok).toBe(true);
  });

  it("refuse une transparence hors du voile de modale", () => {
    const r = check({ "styles/a.css": ".card{background:rgba(0,0,0,.5)}\n" });
    expect(r.ok).toBe(false);
  });
});
