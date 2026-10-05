import { expect, test, type Page } from "@playwright/test";
import { axe, login } from "./helpers";

// Jalon 2 : tableau de bord (écran 2), saisie (écran 3), confirmation (écran 4),
// fiche rejetée (écran 5). Horloge de démonstration : jeudi 19 mars 2026 (TIMESHEET_NOW).
// Aïcha Ndongo et Kevin Fotso sont lus sans être modifiés ; les parcours qui écrivent
// passent par des comptes remis à zéro avant chaque exécution (prisma/e2e-fixtures.ts).
const AICHA = "aicha.ndongo@exemple.com";
const KEVIN = "kevin.fotso@exemple.com";
const LAURE = "laure.bikoi@exemple.com";
const IBRAHIM = "ibrahim.njoya@exemple.com";
const SANDRINE = "sandrine.mvondo@exemple.com";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

async function signIn(page: Page, email: string) {
  await login(page, email);
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Bonjour/ })).toBeVisible();
}

async function openWeek(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}

test.describe("tableau de bord (écran 2)", () => {
  test("desktop : à faire, semaine en cours, projets, dernières semaines", async ({ page }) => {
    test.skip(isMobile(page), "Mise en page desktop");
    await signIn(page, AICHA);
    await expect(page.getByText("Stagiaire · CX Expertise · Manager : Samuel Etoga")).toBeVisible();

    const todo = page.locator("section[aria-labelledby='titre-afaire']");
    await expect(todo.getByText("2 actions")).toBeVisible();
    await expect(todo.getByText("Semaine 11 non saisie")).toBeVisible();
    await expect(todo.getByText(/^Du 9 au 13 mars 2026 · 40\sh à saisir · échéance dépassée depuis le 13 mars$/)).toBeVisible();
    await expect(todo.getByRole("link", { name: "Saisir la semaine 11" })).toHaveAttribute("href", "/saisie/2026/11");
    await expect(todo.getByText("Fiche de présence de février 2026 à signer")).toBeVisible();
    await expect(todo.getByText(/^160\sh validées · générée le 9 mars 2026/).filter({ visible: true })).toBeVisible();
    await expect(todo.getByRole("link", { name: "Signer ma fiche" })).toHaveAttribute("href", "/fiche-presence/2026/2");

    const week = page.locator("section[aria-labelledby='titre-semaine']");
    await expect(week.getByText("Brouillon", { exact: true })).toBeVisible();
    await expect(week).toContainText(/24\sh\s*saisies sur 40\sh/);
    await expect(week.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    const days = week.getByRole("list", { name: "Heures par jour" }).getByRole("listitem");
    await expect(days).toHaveCount(5);
    await expect(days.nth(3)).toContainText("Aujourd'hui");
    await expect(days.nth(3)).toContainText("À saisir");
    await expect(days.nth(4)).toContainText("À venir");
    await expect(week.getByText("À soumettre avant le vendredi 20 mars 2026 à 18:00.")).toBeVisible();

    // Un seul bouton primaire à l'écran : « Continuer la saisie ».
    await expect(page.locator(".btn-primary:visible")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Continuer la saisie" })).toHaveAttribute("href", "/saisie/2026/12");

    const projects = page.locator("section[aria-labelledby='titre-projets'] li").filter({ visible: true });
    await expect(projects.first()).toContainText("Refonte parcours souscription");
    await expect(projects.first()).toContainText(/11\sh cette semaine/);
    await expect(projects.last()).toContainText("Enquête boutiques T2 2026");
    await expect(projects.last()).toContainText("Saisie pas encore ouverte");
    await expect(page.getByText("Tests d'usage appli mobile")).toHaveCount(0);

    const history = page.locator("section[aria-labelledby='titre-histo'] tbody tr");
    await expect(history).toHaveCount(4);
    await expect(history.nth(0)).toContainText("Brouillon");
    await expect(history.nth(1)).toContainText("Manquante");
    await expect(history.nth(1).getByRole("link")).toHaveText("Saisir");
    await expect(history.nth(2).getByRole("link")).toHaveText("Consulter");
    expect(await axe(page)).toEqual([]);

    // Le sélecteur change la semaine de la carte, annoncé par une zone de statut.
    await week.getByRole("button", { name: "Semaine précédente : semaine 11" }).click();
    await expect(page).toHaveURL(/\?annee=2026&semaine=11$/);
    await expect(week.getByText("Manquante", { exact: true })).toBeVisible();
    await expect(week).toContainText(/0\sh\s*saisies sur 40\sh/);
  });

  test("mobile : listes à la place des tableaux", async ({ page }) => {
    test.skip(!isMobile(page), "Mise en page mobile");
    await signIn(page, AICHA);
    await expect(page.getByText("Stagiaire · CX Expertise", { exact: true })).toBeVisible();
    await expect(page.getByText(/^9–13 mars 2026 · 40\sh à saisir · échéance dépassée$/)).toBeVisible();
    const days = page.getByRole("list", { name: "Heures par jour" }).getByRole("listitem");
    await expect(days).toHaveCount(5);
    await expect(days.nth(3)).toContainText("Jeu 19 (aujourd'hui)");
    await expect(page.locator("table:visible")).toHaveCount(0);
    await expect(page.locator("section[aria-labelledby='titre-histo'] li")).toHaveCount(3);
    await expect(page.getByText("Dès le 6 avril")).toBeVisible();
    await expect(page.locator(".btn-primary:visible")).toHaveCount(1);
    expect(await axe(page)).toEqual([]);
  });
});

test.describe("saisie hebdomadaire (écran 3)", () => {
  test("desktop : grille, totaux du jour, raison du bouton désactivé, clavier", async ({ page }) => {
    test.skip(isMobile(page), "Grille desktop");
    await signIn(page, AICHA);
    await openWeek(page, "/saisie/2026/12");
    await expect(page.getByRole("heading", { level: 1, name: "Saisie hebdomadaire", exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Heures par projet et par jour, semaine 12 du 16 au 20 mars 2026" })).toBeVisible();
    await expect(page.getByText(/^Règle de la division : 8\sh par jour ouvré, par pas de 0,5\sh\.$/)).toBeVisible();
    await expect(page.getByLabel("Refonte parcours souscription, lundi 16, heures")).toHaveValue("4");
    await expect(page.getByLabel("Cartographie des irritants, mardi 17, heures")).toHaveValue("0");
    await expect(page.getByLabel("Cartographie des irritants, jeudi 19, heures")).toHaveValue("");
    await expect(page.locator("#raison-soumission")).toHaveText(/^Il reste 16\sh à saisir : jeudi 19 et vendredi 20 mars\.$/);
    await expect(page.getByRole("button", { name: "Soumettre la semaine" })).toBeDisabled();
    // Saisie future interdite : la flèche suivante est désactivée sur la semaine courante.
    await expect(page.getByRole("button", { name: /^Semaine suivante indisponible/ })).toBeDisabled();

    // Les flèches déplacent dans la grille.
    await page.getByLabel("Refonte parcours souscription, lundi 16, heures").focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByLabel("Baromètre NPS T1 2026, lundi 16, heures")).toBeFocused();
    expect(await axe(page)).toEqual([]);
  });

  test("semaine future et semaine inexistante", async ({ page }) => {
    await signIn(page, AICHA);
    await openWeek(page, "/saisie/2026/13");
    await expect(page.getByText("Votre division n'autorise pas la saisie des semaines futures.", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: "Aller à la semaine courante" }).click();
    await expect(page).toHaveURL(/\/saisie\/2026\/12$/);
    const r = await page.goto("/saisie/2026/60");
    expect(r?.status()).toBe(404);
  });

  test("desktop : ajout de lignes, sauvegarde automatique, retrait annulé, soumission", async ({ page }) => {
    test.setTimeout(90_000); // parcours long : connexion, saisie, sauvegarde, rechargement, soumission
    test.skip(isMobile(page), "Parcours desktop");
    await signIn(page, LAURE);
    await openWeek(page, "/saisie/2026/12");

    // Semaine vide : l'état vide propose d'ajouter une ligne.
    await expect(page.getByRole("heading", { name: "Aucune ligne pour cette semaine" })).toBeVisible();
    await expect(page.locator(".btn-primary:visible")).toHaveCount(1);
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await page.getByRole("button", { name: /^Refonte parcours souscription\s*Tests utilisateurs$/ }).click();
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await page.getByRole("button", { name: /^Veille et formation\s*Formation$/ }).click();

    for (const day of ["lundi 16", "mardi 17", "mercredi 18", "jeudi 19", "vendredi 20"]) {
      await page.getByLabel(`Refonte parcours souscription, ${day}, heures`).fill("5");
      await page.getByLabel(`Veille et formation, ${day}, heures`).fill("3");
    }
    await expect(page.getByRole("status").filter({ hasText: /^Brouillon enregistré automatiquement à \d\d:\d\d$/ })).toBeVisible();

    // Retrait immédiat, message avec « Annuler ».
    await page.getByRole("button", { name: "Retirer la ligne Veille et formation" }).click();
    await expect(page.getByLabel("Veille et formation, lundi 16, heures")).toHaveCount(0);
    await expect(page.getByText("Ligne « Veille et formation · Formation » retirée de la grille.")).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByLabel("Veille et formation, lundi 16, heures")).toHaveValue("3");

    // Une valeur hors pas est refusée, avec le message sous la grille.
    await page.getByLabel("Refonte parcours souscription, lundi 16, heures").fill("5,3");
    await expect(page.getByLabel("Refonte parcours souscription, lundi 16, heures")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "Soumettre la semaine" })).toBeDisabled();
    await page.getByLabel("Refonte parcours souscription, lundi 16, heures").fill("5");

    // La sauvegarde a bien eu lieu : on relit la page.
    await expect(page.locator("#raison-soumission")).toHaveText("La semaine est complète. Vous pouvez la soumettre.");
    await page.waitForTimeout(1500);
    await page.waitForLoadState("networkidle");
    await openWeek(page, "/saisie/2026/12");
    await expect(page.getByLabel("Veille et formation, vendredi 20, heures")).toHaveValue("3");
    await expect(page.getByLabel("Refonte parcours souscription, lundi 16, heures")).toHaveValue("5");

    // Écran 4 : la modale récapitule avant d'engager.
    await page.getByRole("button", { name: "Soumettre la semaine" }).click();
    const dialog = page.getByRole("dialog", { name: "Soumettre la semaine 12 ?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("16–20 mars 2026");
    await expect(dialog).toContainText("Samuel Etoga, manager");
    await expect(dialog.getByRole("row", { name: /Refonte parcours souscription · Tests utilisateurs/ })).toContainText(/25\sh/);
    await expect(dialog).toContainText(/40\sh sur 40\sh/);
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Soumettre la semaine" })).toBeFocused();

    await page.getByRole("button", { name: "Soumettre la semaine" }).click();
    await dialog.getByRole("button", { name: "Confirmer la soumission" }).click();
    await expect(page).toHaveURL(/\/saisie\/2026\/12\?soumise=1$/);
    await expect(page.getByText("Semaine 12 soumise")).toBeVisible();
    await expect(page.getByText("En attente de validation", { exact: true })).toBeVisible();
    // Lecture seule : des valeurs en texte, plus de champs.
    const grid = page.getByRole("table", { name: /^Heures soumises, semaine 12/ });
    await expect(grid).toBeVisible();
    await expect(grid.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByText(/^Soumise par vous/)).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("mobile : un jour à la fois, ligne verrouillée, jour suivant", async ({ page }) => {
    test.skip(!isMobile(page), "Saisie mobile");
    await signIn(page, SANDRINE);
    await openWeek(page, "/saisie/2026/12");
    await expect(page.getByRole("heading", { level: 1, name: "Saisie", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Jeu 19/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Jeudi 19 mars" })).toBeVisible();

    // Projet terminé : la ligne reste visible, sans champ.
    await expect(page.getByText("Tests utilisateurs · Saisie fermée").filter({ visible: true })).toBeVisible();
    await expect(page.getByLabel(/^Tests d'usage appli mobile/)).toHaveCount(0);

    await page.getByLabel("Veille et formation Formation").fill("8");
    await expect(page.getByRole("status").filter({ hasText: /^Brouillon enregistré à \d\d:\d\d$/ })).toBeVisible();
    await page.getByRole("button", { name: "Jour suivant : vendredi 20" }).click();
    await expect(page.getByRole("heading", { name: "Vendredi 20 mars" })).toBeFocused();
    await page.getByRole("button", { name: "Ajouter 0,5 h" }).click();
    await expect(page.getByLabel("Veille et formation Formation")).toHaveValue("0,5");
    await page.getByLabel("Veille et formation Formation").fill("8");
    await expect(page.getByRole("button", { name: "Soumettre la semaine" })).toBeEnabled();
    expect(await axe(page)).toEqual([]);
  });
});

test.describe("fiche rejetée (écran 5)", () => {
  test("desktop : bandeau, cellule signalée, historique", async ({ page }) => {
    test.skip(isMobile(page), "Grille desktop");
    await signIn(page, KEVIN);
    await openWeek(page, "/saisie/2026/12");
    const banner = page.getByRole("alert").filter({ hasText: "Fiche rejetée par Samuel Etoga" });
    await expect(banner).toContainText("Lundi 23 mars 2026 à 09:15");
    await expect(banner).toContainText("Motif : « Jeudi 19 mars, 5 h déclarées sur Refonte parcours souscription");
    await expect(page.getByRole("status").filter({ hasText: "Fiche rouverte à la saisie. Aucune modification pour l'instant." })).toBeVisible();

    await banner.getByRole("link", { name: "Aller à la cellule signalée" }).click();
    const cell = page.getByLabel("Refonte parcours souscription, jeudi 19, heures");
    await expect(cell).toBeFocused();
    await expect(cell).toHaveAttribute("aria-invalid", "true");
    const describedBy = await cell.getAttribute("aria-describedby");
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(
      /Jeudi 19 mars, Refonte parcours souscription : 5\sh signalées par votre manager\. Modifiez cette cellule ou réaffectez les heures\./,
    );
    await expect(page.locator("tfoot")).toContainText("À corriger");
    await expect(page.getByText("Corrigez la cellule signalée, puis soumettez à nouveau la fiche à Samuel Etoga.").filter({ visible: true })).toBeVisible();
    await expect(page.getByLabel("Votre réponse au manager (facultatif)")).toBeVisible();
    const history = page.locator("section[aria-labelledby='titre-histo'] li");
    await expect(history.nth(0)).toContainText("Rejetée par Samuel Etoga");
    await expect(history.nth(1)).toContainText("Soumise par vous");
    await expect(page.getByRole("button", { name: "Soumettre à nouveau" })).toBeEnabled();
    expect(await axe(page)).toEqual([]);
  });

  test("desktop : correction de la cellule, nouvelle soumission", async ({ page }) => {
    test.setTimeout(90_000); // parcours long : connexion, saisie, sauvegarde, rechargement, soumission
    test.skip(isMobile(page), "Parcours desktop");
    await signIn(page, IBRAHIM);
    // Le tableau de bord signale la fiche à corriger.
    await expect(page.getByText("Semaine 12 rejetée par Samuel Etoga")).toBeVisible();
    await page.getByRole("link", { name: "Corriger la semaine 12" }).click();
    await expect(page.locator("main[aria-busy]")).toHaveCount(0);

    const cell = page.getByLabel("Refonte parcours souscription, jeudi 19, heures");
    await expect(cell).toHaveAttribute("aria-invalid", "true");
    await cell.fill("6");
    await page.getByLabel("Veille et formation, jeudi 19, heures").fill("2");
    // La cellule modifiée n'est plus signalée.
    await expect(cell).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("tfoot")).not.toContainText("À corriger");
    await page.getByLabel("Votre réponse au manager (facultatif)").fill("Heures réaffectées à la formation.");

    await page.getByRole("button", { name: "Soumettre à nouveau" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmer la soumission" }).click();
    await expect(page).toHaveURL(/\?soumise=1$/);
    await expect(page.getByText("En attente de validation", { exact: true })).toBeVisible();
    const history = page.locator("section[aria-labelledby='titre-histo'] li");
    await expect(history).toHaveCount(3);
    await expect(history.nth(0)).toContainText("Soumise par vous");
  });
});
