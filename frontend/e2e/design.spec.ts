import { expect, test } from "@playwright/test";
import { axe } from "./helpers";

// Jalon 9 de la réécriture : planches de composants (/design, développement seulement),
// reprises de e2e/design.spec.ts. Zéro violation axe sérieuse ou critique sur chaque planche,
// au bureau et sur mobile ; comportements clavier des fenêtres et des menus. La saisie par
// jour (C2) est vérifiée dans saisie.spec.ts.
const ROUTES = ["/design", "/design/c1", "/design/c2-a", "/design/c2-b", "/design/c4"];

test.describe("planches : accessibilité (axe-core)", () => {
  for (const route of ROUTES) {
    test(`${route} : aucune violation sérieuse ou critique`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }
});

test.describe("comportements clavier", () => {
  test.beforeEach(() => test.skip(test.info().project.name !== "desktop", "Vérifié sur le bureau"));

  test("fenêtre : focus piégé, Échap ferme, le focus revient au déclencheur", async ({ page }) => {
    await page.goto("/design");
    const trigger = page.getByRole("button", { name: "Ouvrir la fenêtre" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Soumettre la semaine 12 ?" });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("menu : flèches, Échap et retour du focus", async ({ page }) => {
    await page.goto("/design");
    const trigger = page.getByRole("button", { name: "Actions" });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    // HeadlessUI : le focus reste sur la liste, l'élément actif est désigné (aria-activedescendant).
    const menu = page.getByRole("menu");
    const items = page.getByRole("menuitem");
    await expect(menu).toBeFocused();
    await expect(items.first()).toHaveAttribute("data-focus", "");
    await expect(items.first()).toContainText("(actuel)");
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toHaveAttribute("data-focus", "");
    await expect(menu).toHaveAttribute("aria-activedescendant", (await items.nth(1).getAttribute("id")) ?? "");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("panneau latéral : Échap ferme et rend le focus", async ({ page }) => {
    await page.goto("/design");
    const trigger = page.getByRole("button", { name: "Ouvrir le panneau" });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Nouveau projet" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Nouveau projet" })).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
