import { describe, expect, it } from "vitest";
import { pageItems } from "./pagination";

describe("pagination", () => {
  it("montre toutes les pages jusqu'à 7", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("abrège les longues listes, comme la planche 13", () => {
    expect(pageItems(1, 36)).toEqual([1, 2, 3, "…", 36]);
    expect(pageItems(18, 36)).toEqual([1, "…", 17, 18, 19, "…", 36]);
    expect(pageItems(36, 36)).toEqual([1, "…", 34, 35, 36]);
    expect(pageItems(3, 36)).toEqual([1, 2, 3, 4, "…", 36]);
  });
});
