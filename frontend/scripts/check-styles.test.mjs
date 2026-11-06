import { describe, expect, it } from "vitest";
import { checkSource } from "./check-styles.mjs";

const tsx = (classes) => `export const X = () => <div className="${classes}" />;`;
const problems = (classes, path = "src/shared/ui/X.tsx") => checkSource(path, tsx(classes));

describe("contrôle de style", () => {
  it("accepte les classes du thème", () => {
    expect(problems("flex gap-20 p-10 border-2 border-black rounded-md bg-primary font-bold text-h3 hover:bg-black")).toEqual([]);
  });

  it("refuse les valeurs arbitraires", () => {
    expect(problems("p-[7px]")).toHaveLength(1);
    // Signalée deux fois : valeur arbitraire et couleur en dur.
    expect(problems("text-[#123456]").some((p) => p.startsWith("valeur arbitraire"))).toBe(true);
    expect(problems("md:w-[340px]")).toHaveLength(1);
  });

  it("refuse les bordures autres que 2 px", () => {
    expect(problems("border")).toHaveLength(1);
    expect(problems("border-b")).toHaveLength(1);
    expect(problems("border-4")).toHaveLength(1);
    expect(problems("border-0 border-t-2")).toEqual([]);
  });

  it("refuse les opacités, sauf le voile de modale", () => {
    expect(problems("opacity-50")).toHaveLength(1);
    expect(problems("bg-primary/80")).toHaveLength(1);
    expect(problems("bg-black/50")).toEqual([]);
  });

  it("refuse les dégradés, les graisses intermédiaires et les grands rayons", () => {
    expect(problems("bg-linear-to-r")).toHaveLength(1);
    expect(problems("from-primary")).toHaveLength(1);
    expect(problems("font-semibold")).toHaveLength(1);
    expect(problems("rounded-full")).toHaveLength(1);
  });

  it("réserve les couleurs de séries aux graphiques", () => {
    expect(problems("bg-chart-1")).toHaveLength(1);
    expect(problems("bg-chart-1", "src/shared/ui/charts/Bars.tsx")).toEqual([]);
  });

  it("refuse les couleurs en dur et les styles en ligne", () => {
    expect(checkSource("src/x.tsx", `const c = "#ff7900";`)).toHaveLength(1);
    expect(checkSource("src/x.tsx", `<div style={{ width: 3 }} />`)).toHaveLength(1);
    expect(checkSource("src/x.css", `.a { color: #000; }`)).toHaveLength(1);
    expect(checkSource("src/x.css", `.a { font-weight: 600; }`)).toHaveLength(1);
  });
});
