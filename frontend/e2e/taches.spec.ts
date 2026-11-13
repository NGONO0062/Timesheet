import { expect, test, type Page } from "@playwright/test";
import { axe, signedIn } from "./helpers";

// Jalon 8 de la réécriture : tableau Kanban d'un projet (écran 15, PROMPT.md §9.12), repris de
// e2e/taches.spec.ts. Les tâches sont créées dans la « Division de test » (base recréée à
// chaque exécution). Bureau et mobile tournent en parallèle : chacun sur son propre projet.
const DAVID = "david.e2e@exemple.com";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const column = (page: Page, name: RegExp) => page.getByRole("region", { name });

async function openBoard(page: Page, project: string) {
  await signedIn(page, DAVID);
  if (isMobile(page)) {
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Tâches" }).click();
  } else {
    await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Tâches" }).click();
  }
  await expect(page.getByRole("heading", { level: 1, name: "Tâches" })).toBeVisible();
  await page.getByLabel("Projet", { exact: true }).selectOption({ label: project });
  await expect(page.getByRole("heading", { level: 2, name: project.split(" · ")[1] })).toBeVisible();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
}

test("bureau : création, déplacement par l'étiquette et par glisser-déposer, renommage, suppression annulée", async ({ page }) => {
  test.setTimeout(90_000);
  test.skip(isMobile(page), "Glisser-déposer : bureau");
  await openBoard(page, "TEST-01 · Projet de test");
  const board = page.getByRole("group", { name: "Tableau des tâches de Projet de test" });
  await expect(board.getByRole("region")).toHaveCount(5);
  await expect(column(page, /^Backlog, 0 tâche$/)).toContainText("Aucune tâche");

  // Titre vide : message sous le champ.
  await page.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(page.getByText("Saisissez le titre de la tâche.")).toBeVisible();
  await page.getByLabel("Nouvelle tâche").fill("Préparer l'atelier");
  await page.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tâche « Préparer l'atelier » ajoutée dans Backlog." })).toBeVisible();
  await expect(page.getByLabel("Nouvelle tâche")).toHaveValue("");
  await expect(column(page, /^Backlog, 1 tâche$/).getByRole("heading", { name: "Préparer l'atelier" })).toBeVisible();
  await expect(column(page, /^Backlog, 1 tâche$/)).toContainText("Créée par David Essai");
  expect(await axe(page)).toEqual([]);

  // Au clavier : l'étiquette ouvre les colonnes ; « Annuler » remet la carte.
  await page.getByRole("button", { name: "Colonne de « Préparer l'atelier » : Backlog. Déplacer" }).click();
  await page.getByRole("menuitem", { name: /^En cours/ }).click();
  const moved = page.getByRole("status").filter({ hasText: "« Préparer l'atelier » déplacée dans « En cours »." });
  await expect(moved).toBeVisible();
  await expect(column(page, /^En cours, 1 tâche$/).getByRole("heading", { name: "Préparer l'atelier" })).toBeVisible();
  await moved.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Changement annulé." })).toBeVisible();
  await expect(column(page, /^Backlog, 1 tâche$/).getByRole("heading", { name: "Préparer l'atelier" })).toBeVisible();

  // À la souris : glisser la carte dans « En revue ».
  // La carte se prend par son titre (le milieu peut tomber sur un bouton).
  await page.locator("article", { hasText: "Préparer l'atelier" }).dragTo(column(page, /^En revue, 0 tâche$/), { sourcePosition: { x: 20, y: 15 } });
  await expect(column(page, /^En revue, 1 tâche$/).getByRole("heading", { name: "Préparer l'atelier" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "« Préparer l'atelier » déplacée dans « En revue »." })).toBeVisible();
  await page.reload();
  await expect(column(page, /^En revue, 1 tâche$/).getByRole("heading", { name: "Préparer l'atelier" })).toBeVisible();

  // Renommage, puis suppression annulée.
  await page.getByRole("button", { name: "Renommer la tâche « Préparer l'atelier »" }).click();
  await page.getByLabel("Titre de la tâche").fill("Atelier de cadrage");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tâche renommée : « Atelier de cadrage »." })).toBeVisible();
  await page.getByRole("button", { name: "Supprimer la tâche « Atelier de cadrage »" }).click();
  const deleted = page.getByRole("status").filter({ hasText: "Tâche « Atelier de cadrage » supprimée." });
  await expect(deleted).toBeVisible();
  await expect(column(page, /^En revue, 0 tâche$/)).toBeVisible();
  await deleted.getByRole("button", { name: "Annuler" }).click();
  await expect(column(page, /^En revue, 1 tâche$/).getByRole("heading", { name: "Atelier de cadrage" })).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("mobile : colonnes l'une sous l'autre, déplacement par l'étiquette", async ({ page }) => {
  test.skip(!isMobile(page), "Mise en page mobile");
  await openBoard(page, "TEST-04 · Veille et formation");
  await page.getByLabel("Nouvelle tâche").fill("Lire le rapport annuel");
  await page.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(column(page, /^Backlog, 1 tâche$/).getByRole("heading", { name: "Lire le rapport annuel" })).toBeVisible();
  await page.getByRole("button", { name: "Colonne de « Lire le rapport annuel » : Backlog. Déplacer" }).click();
  await page.getByRole("menuitem", { name: /^Terminée/ }).click();
  await expect(column(page, /^Terminée, 1 tâche$/).getByRole("heading", { name: "Lire le rapport annuel" })).toBeVisible();
  // Pas de défilement horizontal de la page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await axe(page)).toEqual([]);
});

test("projet terminé en lecture seule, projet hors portée introuvable", async ({ page }) => {
  test.skip(isMobile(page), "Vérifié sur le bureau");
  await openBoard(page, "TEST-03 · Projet terminé");
  await expect(page.getByText("Projet terminé : son tableau reste lisible, en lecture seule.")).toBeVisible();
  await expect(page.getByLabel("Nouvelle tâche")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Colonne de/ })).toHaveCount(0);
  await page.goto("/taches?projet=inconnu");
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
});

test("les projets ouvrent leur tableau depuis l'écran Projets", async ({ page }) => {
  test.skip(isMobile(page), "Vérifié sur le bureau");
  await signedIn(page, "valideur.e2e@exemple.com");
  await page.goto("/projets");
  await page.getByRole("link", { name: "Voir les tâches de Projet en pause" }).first().click();
  await expect(page).toHaveURL(/\/taches\?projet=/);
  await expect(page.getByRole("heading", { level: 2, name: "Projet en pause" })).toBeVisible();
});
