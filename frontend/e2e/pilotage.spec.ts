import { expect, test, type Page } from "@playwright/test";
import { axe, signedIn } from "./helpers";

// Jalon 4 de la réécriture : projets (écran 09), reporting et exports (écran 10), vue
// consolidée (écran 11), repris de e2e/pilotage.spec.ts. Les données de démonstration (CX
// Expertise) sont lues sans être modifiées ; les écritures passent par la « Division de test »
// (Martin Valideur), remise à zéro avant les tests.
const SAMUEL = "samuel.etoga@exemple.com";
const AICHA = "aicha.ndongo@exemple.com";
const MARTIN = "valideur.e2e@exemple.com";

const desktop = () => test.skip(test.info().project.name !== "desktop", "Écrans de pilotage : bureau ; le mobile est vérifié à part");

async function open(page: Page, email: string, path: string, title: string) {
  await signedIn(page, email);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
}

const row = (page: Page, name: string) => page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${name}`) }) });

test.describe("projets (écran 09)", () => {
  test("démonstration : liste, filtres et affichage dans l'adresse, colonnes, accès", async ({ page }) => {
    desktop();
    await open(page, SAMUEL, "/projets", "Projets");
    await expect(page.getByText("7 projets · 4 en cours")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tous (7)" })).toHaveAttribute("aria-pressed", "true");
    await expect(row(page, "Veille et formation")).toContainText("Toute l'année 2026");
    await expect(row(page, "Refonte parcours souscription")).toContainText(/Budget dépassé de 9\sjours/);
    await expect(row(page, "Refonte FAQ en ligne").getByRole("button", { name: "Statut de Refonte FAQ en ligne : En pause. Modifier" })).toBeVisible();
    expect(await axe(page)).toEqual([]);

    await page.getByRole("button", { name: "En cours (4)" }).click();
    await expect(page).toHaveURL(/statut=IN_PROGRESS/);
    await expect(page.getByRole("table", { name: "Projets de l'équipe au statut En cours" }).getByRole("rowheader")).toHaveCount(4);

    await page.getByRole("button", { name: "Colonnes" }).click();
    await expect(page).toHaveURL(/vue=colonnes/);
    await expect(page.getByRole("region", { name: "En cours, 4 projets" })).toBeVisible();
    await expect(page.getByRole("region", { name: "En pause, 1 projet" })).toContainText("Refonte FAQ en ligne");
    expect(await axe(page)).toEqual([]);

    // Un collaborateur n'a pas l'écran.
    await page.context().clearCookies();
    await signedIn(page, AICHA);
    await page.goto("/projets");
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  });

  test("création avec erreurs, statut avec « Annuler », colonnes, archivage", async ({ page }) => {
    desktop();
    await open(page, MARTIN, "/projets", "Projets");
    await expect(page.getByText("4 projets · 2 en cours")).toBeVisible();

    // Panneau de création : erreurs sous les champs, focus sur la première.
    await page.getByRole("button", { name: "Nouveau projet" }).click();
    const panel = page.getByRole("dialog", { name: "Nouveau projet" });
    await expect(panel.getByRole("group", { name: "Membres affectés (0 sur 6)" })).toBeVisible();
    await panel.getByRole("button", { name: "Créer le projet" }).click();
    await expect(panel.getByText("Saisissez le nom du projet.")).toBeVisible();
    await expect(panel.getByLabel("Nom du projet")).toBeFocused();
    expect(await axe(page)).toEqual([]);

    await panel.getByLabel("Nom du projet").fill("Projet de test e2e");
    await panel.getByLabel("Date de début").fill("01/04/2026");
    await panel.getByLabel("Date de fin").fill("31/03/2026");
    await panel.getByLabel("Statut").selectOption({ label: "En cours" });
    await panel.getByLabel("Budget en jours").fill("30");
    await panel.getByRole("button", { name: "Créer le projet" }).click();
    await expect(panel.getByText("Saisissez une date de fin au format jj/mm/aaaa, après la date de début.")).toBeVisible();
    await expect(panel.getByText("Ajoutez au moins une activité.")).toBeVisible();
    await panel.getByLabel("Date de fin").fill("30/06/2026");
    await panel.getByPlaceholder("Nouvelle activité").fill("Analyse");
    await panel.getByRole("button", { name: "Ajouter" }).click();
    await expect(panel.getByRole("button", { name: "Retirer l'activité Analyse" })).toBeVisible();
    await panel.getByLabel("Alice Essai").check();
    await expect(panel.getByRole("group", { name: "Membres affectés (1 sur 6)" })).toBeVisible();
    await panel.getByRole("button", { name: "Créer le projet" }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Projet « Projet de test e2e » créé avec le statut « En cours »." })).toBeVisible();
    await expect(row(page, "Projet de test e2e")).toContainText(/0 \/ 30\sjours · 0\s%/);
    await expect(row(page, "Projet de test e2e")).toContainText("TESTS-2026-01");
    await expect(page.getByText("5 projets · 3 en cours")).toBeVisible();

    // Statut : changement immédiat, puis « Annuler ».
    const trigger = () => row(page, "Projet terminé").getByRole("button", { name: /^Statut de Projet terminé/ });
    await trigger().click();
    await page.getByRole("menu", { name: /^Statut de Projet terminé/ }).getByRole("menuitem", { name: "En pause" }).click();
    const notice = page.getByRole("status").filter({ hasText: "« Projet terminé » est passé à « En pause »." });
    await expect(notice).toContainText("La saisie des temps y est fermée.");
    await expect(trigger()).toHaveAccessibleName(/En pause/);
    await notice.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Changement annulé." })).toBeVisible();
    await expect(trigger()).toHaveAccessibleName(/Terminé/);

    // Vue en colonnes : glisser la carte change le statut, avec le même « Annuler ».
    await page.getByRole("button", { name: "Colonnes" }).click();
    await expect(page).toHaveURL(/vue=colonnes/);
    await page.locator("article", { hasText: "Projet terminé" }).dragTo(page.getByRole("region", { name: "En pause, 1 projet" }));
    const dropped = page.getByRole("status").filter({ hasText: "« Projet terminé » est passé à « En pause »." });
    await expect(dropped).toBeVisible();
    await expect(page.getByRole("region", { name: "En pause, 2 projets" })).toContainText("Projet terminé");
    await dropped.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Changement annulé." })).toBeVisible();
    await expect(page.getByRole("region", { name: "Terminé, 1 projet" })).toContainText("Projet terminé");
    await page.getByRole("button", { name: "Liste" }).click();

    // Archivage : le projet quitte la liste, l'interrupteur le fait revenir.
    await page.getByRole("button", { name: "Modifier Projet de test e2e" }).click();
    const edit = page.getByRole("dialog", { name: "Modifier le projet" });
    await expect(edit.getByLabel("Nom du projet")).toHaveValue("Projet de test e2e");
    await expect(edit.getByLabel("Date de fin")).toHaveValue("30/06/2026");
    await edit.getByRole("button", { name: "Archiver le projet" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Projet « Projet de test e2e » archivé. Il n'apparaît plus dans la liste." })).toBeVisible();
    await expect(row(page, "Projet de test e2e")).toHaveCount(0);
    const archived = page.getByRole("switch", { name: "Afficher les projets archivés" });
    // L'interrupteur suit l'adresse : il est coché une fois la navigation faite.
    await archived.click();
    await expect(page).toHaveURL(/archives=1/);
    await expect(archived).toBeChecked();
    await expect(row(page, "Projet de test e2e")).toContainText("Archivé");
  });

  test("mobile 375 : la liste seule, sans défilement horizontal de la page", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Mobile seulement");
    await open(page, SAMUEL, "/projets?vue=colonnes", "Projets");
    await expect(page.getByRole("button", { name: "Colonnes" })).toBeHidden();
    await expect(row(page, "Veille et formation")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect(await axe(page)).toEqual([]);
  });
});

test.describe("reporting (écran 10)", () => {
  test("indicateurs, axes et périmètre dans l'adresse, exports CSV, Excel et PDF, accès", async ({ page }) => {
    desktop();
    await open(page, SAMUEL, "/reporting?de=2026-10&a=2026-12", "Reporting");
    await expect(page.getByLabel("De la semaine")).toHaveValue("2026-10");
    await expect(page.getByLabel("À la semaine")).toHaveValue("2026-12");
    const kpis = page.getByRole("list", { name: "Indicateurs de la période" });
    await expect(kpis).toContainText("Jours saisis");
    await expect(kpis).toContainText(/sur 90\sjours de capacité \(6 personnes, 3 semaines\)/);
    await expect(page.getByRole("figure", { name: "Jours par projet, du 2 au 20 mars 2026" })).toBeVisible();
    const detail = page.getByRole("table", { name: "Jours par projet du 2 au 20 mars 2026" });
    await expect(detail.locator("tbody").getByRole("rowheader")).toHaveCount(4);
    await expect(detail.locator("tfoot").getByRole("rowheader")).toHaveText("Total");
    expect(await axe(page)).toEqual([]);

    await page.getByRole("button", { name: "Personne" }).click();
    await expect(page).toHaveURL(/axe=person/);
    await expect(page.getByRole("heading", { name: "Détail par personne" })).toBeVisible();
    await page.getByLabel("Périmètre").selectOption({ label: "Aïcha Ndongo" });
    await expect(page).toHaveURL(/personne=/);
    await expect(page.getByRole("table", { name: /^Jours par personne/ }).locator("tbody").getByRole("rowheader")).toHaveText(["Aïcha Ndongo"]);

    // Exports : mêmes filtres que l'écran.
    await page.getByRole("button", { name: "Exporter" }).click();
    const csvHref = await page.getByRole("menuitem", { name: "CSV" }).getAttribute("href");
    expect(csvHref).toMatch(/axe=person/);
    expect(csvHref).toMatch(/personne=/);
    for (const [format, type] of [["csv", "text/csv"], ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], ["pdf", "application/pdf"]] as const) {
      const r = await page.request.get((csvHref ?? "").replace("format=csv", `format=${format}`));
      expect(r.status(), format).toBe(200);
      expect(r.headers()["content-type"]).toContain(type);
      expect(r.headers()["content-disposition"]).toContain(`filename=Reporting_2026-S10_2026-S12.${format}`);
      const body = await r.body();
      if (format === "csv") expect(body.toString("utf8")).toContain("Aïcha Ndongo");
      if (format === "xlsx") expect(body.subarray(0, 2).toString()).toBe("PK");
      if (format === "pdf") expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    }

    // Sans la permission : ni l'écran, ni les exports.
    await page.context().clearCookies();
    await signedIn(page, AICHA);
    await page.goto("/reporting");
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    expect((await page.request.get("/api/v1/reporting/export?format=csv")).status()).toBe(404);
  });
});

test.describe("vue division (écran 11)", () => {
  test("indicateurs, équipes, tendance, dérives, relance, semaine précédente, accès", async ({ page }) => {
    desktop();
    test.setTimeout(90_000);
    await open(page, "brigitte.mbarga@exemple.com", "/division", "Division CX Expertise");
    await expect(page.getByText("3 équipes · 15 collaborateurs")).toBeVisible();
    const kpis = page.getByRole("list", { name: "Indicateurs de la semaine 12" });
    for (const label of ["Taux de remplissage", "Fiches soumises", "Fiches validées", "Dérives à traiter"]) await expect(kpis).toContainText(label);
    const teams = page.getByRole("table", { name: "Remplissage, soumission et validation par équipe" });
    for (const name of ["Parcours", "Études", "Data CX", "Division"]) await expect(teams.getByRole("rowheader", { name: new RegExp(`^${name}`) })).toBeVisible();
    await expect(teams).toContainText(/Sous le seuil de 80\s%/);
    const drifts = page.getByRole("table", { name: "Dérives détectées dans la division" });
    for (const type of ["Budget dépassé", "Sous-remplissage", "Validation en retard", "Saisie manquante"]) await expect(drifts).toContainText(type);
    await expect(page.getByRole("button", { name: /Semaine suivante indisponible/ })).toBeDisabled();
    expect(await axe(page)).toEqual([]);

    // Relance du manager : le résultat s'écrit à la place du bouton.
    await drifts.getByRole("button", { name: "Relancer le manager : Olivier Manga" }).click();
    await expect(drifts.getByRole("status").filter({ hasText: "Relance envoyée à Olivier Manga." })).toBeVisible();

    // « Voir le projet » ouvre la fiche du projet, qui explique le dépassement ; « Modifier » y ouvre le panneau de l'écran Projets.
    await drifts.getByRole("link", { name: "Voir le projet : Refonte parcours souscription" }).click();
    await expect(page).toHaveURL(/\/projets\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("region", { name: "Points d'attention" })).toContainText(/Budget dépassé de 9\sjours/);
    await page.getByRole("link", { name: "Modifier Refonte parcours souscription" }).click();
    await expect(page).toHaveURL(/\/projets\?projet=/);
    await expect(page.getByRole("dialog", { name: "Modifier le projet" }).getByLabel("Nom du projet")).toHaveValue("Refonte parcours souscription");

    await page.goto("/division");
    await page.getByRole("button", { name: /^Semaine précédente/ }).click();
    await expect(page).toHaveURL(/annee=2026&semaine=11/);
    await expect(page.getByRole("list", { name: "Indicateurs de la semaine 11" })).toBeVisible();

    // Un manager n'a pas la vue division.
    await page.context().clearCookies();
    await signedIn(page, SAMUEL);
    await page.goto("/division");
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  });
});

test.describe("fiche projet (suivi de projet)", () => {
  test("depuis la liste : points d'attention, indicateurs, équipe, activités, tendance, accès", async ({ page }) => {
    desktop();
    await open(page, SAMUEL, "/projets", "Projets");
    await page.getByRole("link", { name: "Voir la fiche de Refonte parcours souscription" }).click();
    await expect(page).toHaveURL(/\/projets\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Refonte parcours souscription" })).toBeVisible();
    await expect(page.locator("main[aria-busy]")).toHaveCount(0);
    // Le projet de démonstration dépasse son budget de neuf jours : c'est écrit, pas seulement coloré.
    await expect(page.getByRole("region", { name: "Points d'attention" })).toContainText(/Budget dépassé de 9\sjours/);
    const indicators = page.getByRole("list", { name: "Indicateurs du projet" });
    await expect(indicators.getByRole("progressbar", { name: "Budget consommé, Refonte parcours souscription" })).toBeVisible();
    await expect(indicators).toContainText(/dépassé de 9\sjours/);
    await expect(page.getByRole("table", { name: "Jours consommés par personne" }).getByRole("rowheader").first()).toBeVisible();
    await expect(page.getByRole("table", { name: "Jours consommés par activité" }).getByRole("rowheader").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /Semaine 12, en cours/ })).toBeVisible();
    // La fiche est une sous-page de Projets : le lien de navigation reste marqué.
    await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Projets" })).toHaveAttribute("aria-current", "page");
    expect(await axe(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

    await page.getByRole("link", { name: "Voir les tâches" }).click();
    await expect(page).toHaveURL(/\/taches\?projet=/);

    // Projet inconnu ou hors du périmètre : la même réponse.
    await page.goto("/projets/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "Ce projet n'existe pas ou n'est pas dans votre périmètre" })).toBeVisible();
    await page.getByRole("link", { name: "Retour aux projets" }).click();
    await expect(page).toHaveURL(/\/projets$/);

    // Sans la permission « Gérer les projets », la fiche n'existe pas.
    await page.context().clearCookies();
    await signedIn(page, AICHA);
    await page.goto("/projets/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  });

  test("mobile 375 : la fiche tient dans la page", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Mobile seulement");
    await signedIn(page, SAMUEL);
    await page.goto("/projets");
    await page.getByRole("link", { name: "Voir la fiche de Refonte parcours souscription" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Refonte parcours souscription" })).toBeVisible();
    await expect(page.locator("main[aria-busy]")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Indicateurs du projet" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect(await axe(page)).toEqual([]);
  });
});
