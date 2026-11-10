import { expect, test, type Page } from "@playwright/test";
import { axe, signedIn } from "./helpers";

// Jalon 2 de la réécriture : tableau de bord (02), saisie par jour (03), confirmation (04),
// fiche rejetée (05). Lecture sur les données de démonstration (CX Expertise, jamais
// modifiées) ; écritures sur la « Division de test » (saisie.e2e), remise à zéro avant les tests.
const day = (page: Page, label: RegExp) => page.getByLabel(label);

test.describe("tableau de bord (écran 02)", () => {
  test("une seule action principale, la plus urgente ; pas de doublon", async ({ page }) => {
    await signedIn(page, "aicha.ndongo@exemple.com");
    await expect(page.getByRole("heading", { name: "Bonjour Aïcha" })).toBeVisible();
    const todo = page.getByRole("region", { name: "À faire" });
    await expect(todo.getByText("Semaine 11 non saisie")).toBeVisible();
    await expect(page.getByRole("link", { name: "Saisir la semaine 11" })).toBeVisible();
    // La semaine 11 n'est pas répétée dans « Dernières semaines ».
    const history = page.getByRole("region", { name: "Dernières semaines" });
    // Tableau au bureau, liste sur mobile : une seule des deux est visible.
    await expect(history.getByText("Semaine 11", { exact: true })).toHaveCount(0);
    await expect(history.getByText("Semaine 10", { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByText("3 jours", { exact: true })).toBeVisible();
    // Échéance en toutes lettres (maquette 02).
    await expect(page.getByText(/À soumettre avant le vendredi\s20 mars 2026 à 18:00\./)).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
});

test.describe("saisie par jour (écrans 03 à 05)", () => {
  test("brouillon de démonstration : 3 jours sur 5, soumission désactivée avec sa raison", async ({ page }) => {
    await signedIn(page, "aicha.ndongo@exemple.com");
    await page.goto("/saisie/2026/12");
    await expect(day(page, /Lundi 16 mars : projet et activité/)).toHaveValue(/.+/);
    await expect(day(page, /Jeudi 19 mars : projet et activité/)).toHaveValue("");
    await expect(page.getByText("3 sur 5 jours saisis")).toBeVisible();
    await expect(page.getByText(/Il reste 2\sjours à saisir\s:\sjeudi\s19 et vendredi\s20\smars/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Soumettre la semaine" })).toBeDisabled();
    expect(await axe(page)).toEqual([]);
  });

  test("fiche rejetée : motif, journée signalée, historique", async ({ page }) => {
    await signedIn(page, "kevin.fotso@exemple.com");
    await page.goto("/saisie/2026/12");
    const alert = page.getByRole("alert").filter({ hasText: "Fiche rejetée par Samuel Etoga" });
    await expect(alert).toContainText("Merci de réaffecter cette journée.");
    await expect(page.getByText("Fiche rouverte à la saisie. Aucune modification pour l'instant.")).toBeVisible();
    await expect(day(page, /Jeudi 19 mars : projet et activité/)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(/Jeudi 19 mars : journée signalée par votre manager/)).toBeVisible();
    await expect(page.getByText("Soumise", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Soumettre à nouveau" })).toBeEnabled();
    expect(await axe(page)).toEqual([]);
  });

  test("semaine future : fermée par la division", async ({ page }) => {
    await signedIn(page, "aicha.ndongo@exemple.com");
    await page.goto("/saisie/2026/13");
    await expect(page.getByRole("heading", { name: "Semaine future" })).toBeVisible();
    await page.getByRole("button", { name: "Aller à la semaine courante" }).click();
    await expect(page).toHaveURL(/\/saisie\/2026\/12$/);
  });

  test("saisie, sauvegarde automatique, confirmation, soumission", async ({ page }) => {
    test.setTimeout(90_000);
    // Une seule exécution écrit : le projet mobile relit seulement.
    test.skip(test.info().project.name !== "desktop", "Écriture : une seule fois");
    await signedIn(page, "saisie.e2e@exemple.com");
    await page.goto("/saisie");
    await expect(page).toHaveURL(/\/saisie\/2026\/12$/);
    const days = ["Lundi 16", "Mardi 17", "Mercredi 18", "Jeudi 19", "Vendredi 20"];
    await day(page, /Lundi 16 mars/).selectOption({ label: "Projet de test · Analyse" });
    await expect(page.getByText(/Brouillon enregistré automatiquement à/)).toBeVisible();
    // Le brouillon est en base : il revient après rechargement.
    await page.reload();
    await expect(day(page, /Lundi 16 mars/)).not.toHaveValue("");
    // Un projet en pause n'est pas proposé.
    await expect(day(page, /Mardi 17 mars/).getByRole("option", { name: /Projet en pause/ })).toHaveCount(0);
    for (const name of days.slice(1, 4)) await day(page, new RegExp(`${name} mars`)).selectOption({ label: "Projet de test · Atelier" });
    await day(page, /Vendredi 20 mars/).selectOption({ label: "Absence · Absence" });
    await expect(page.getByText("5 sur 5 jours saisis")).toBeVisible();
    await page.getByRole("button", { name: "Soumettre la semaine" }).click();
    const dialog = page.getByRole("dialog", { name: "Soumettre la semaine 12 ?" });
    await expect(dialog.getByText("Martin Valideur, manager")).toBeVisible();
    await expect(dialog.getByText("5 jours sur 5 jours")).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await dialog.getByRole("button", { name: "Confirmer la soumission" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Semaine 12 soumise" })).toBeVisible();
    // Soumise : en lecture seule, plus de liste.
    await expect(page.getByLabel(/Lundi 16 mars : projet et activité/)).toHaveCount(0);
    await expect(page.getByText("Projet de test · Analyse")).toBeVisible();
  });
});

test.describe("mobile 375", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, "Mobile seulement");

  test("un jour par ligne, sans défilement horizontal", async ({ page }) => {
    await signedIn(page, "aicha.ndongo@exemple.com");
    await page.goto("/saisie/2026/12");
    await expect(day(page, /Lundi 16 mars/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect(await axe(page)).toEqual([]);
  });
});
