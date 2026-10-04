import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = ["/design", "/design/c1", "/design/c2-a", "/design/c2-b", "/design/c3", "/design/c4"];

test.describe("accessibilité (axe-core)", () => {
  for (const route of ROUTES) {
    test(`${route} : aucune violation sérieuse ou critique`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)).toEqual([]);
    });
  }
});

test.describe("comportements clavier", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Vérifié sur desktop");

  test("modale : focus piégé, Échap ferme, le focus revient au déclencheur", async ({ page }) => {
    await page.goto("/design");
    const trigger = page.getByRole("button", { name: "Ouvrir la modale" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Soumettre la semaine 12 ?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("dropdown : flèches, Échap et retour du focus", async ({ page }) => {
    await page.goto("/design");
    const trigger = page.locator('[aria-haspopup="true"]', { hasText: "Exporter" });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: "CSV" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: "Excel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("grille : les flèches déplacent, les totaux et la soumission suivent la saisie", async ({ page }) => {
    await page.goto("/design/c2-a");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "2. Partiellement remplie" }) });
    const thu = section.getByRole("textbox", { name: "Refonte parcours souscription, jeudi 19, heures" });
    await thu.click();
    await page.keyboard.press("ArrowDown");
    await expect(section.getByRole("textbox", { name: "Baromètre NPS T1 2026, jeudi 19, heures" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(section.getByRole("textbox", { name: "Baromètre NPS T1 2026, mercredi 18, heures" })).toBeFocused();

    const submit = section.getByRole("button", { name: "Soumettre la semaine" });
    await expect(submit).toBeDisabled();
    await expect(section.getByText("Il reste 16 h à saisir : jeudi 19 et vendredi 20 mars.")).toBeVisible();
    for (const [project, value] of [["Refonte parcours souscription", "4"], ["Baromètre NPS T1 2026", "4"]]) {
      await section.getByRole("textbox", { name: `${project}, jeudi 19, heures` }).fill(value!);
      await section.getByRole("textbox", { name: `${project}, vendredi 20, heures` }).fill(value!);
    }
    await expect(submit).toBeEnabled();
    await expect(section.getByText("La semaine est complète. Vous pouvez la soumettre.")).toBeVisible();
  });

  test("grille : un dépassement est relié aux cellules par aria-describedby", async ({ page }) => {
    await page.goto("/design/c2-a");
    const cell = page.getByRole("textbox", { name: "Refonte parcours souscription, mercredi 18, heures" }).nth(1);
    await expect(cell).toHaveAttribute("aria-invalid", "true");
    const id = await cell.getAttribute("aria-describedby");
    await expect(page.locator(`[id="${id}"]`)).toHaveText(/Mercredi 18 mars : 10\sh saisies pour 8\sh attendues/);
  });

  test("étiquette de projet : changement immédiat avec « Annuler »", async ({ page }) => {
    await page.goto("/design/c4");
    await page.getByRole("button", { name: "Terminé" }).click();
    await expect(page.getByRole("status").filter({ hasText: "est passé à « Terminé »" })).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).first().click();
    await expect(page.getByRole("button", { name: /Statut de Refonte parcours souscription : En cours/ })).toBeVisible();
  });

  test("sélecteur de semaine : navigation annoncée, flèche bloquée si la division l'interdit", async ({ page }) => {
    await page.goto("/design/c1");
    const blocked = page.getByRole("button", { name: /Semaine suivante indisponible/ });
    await expect(blocked).toBeDisabled();
    const card = page.locator(".card", { has: page.getByRole("heading", { name: "Semaine courante", exact: true }) });
    await card.getByRole("button", { name: "Semaine précédente : semaine 11" }).click();
    await expect(card.getByRole("status")).toHaveText("Semaine 11 affichée, 9–13 mars 2026.");
    await expect(card.getByRole("button", { name: "Semaine courante" })).toBeVisible();
  });
});
