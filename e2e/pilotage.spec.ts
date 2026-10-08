import { expect, test, type Page } from "@playwright/test";
import { axe, login } from "./helpers";

// Jalon 4 : projets (écran 9), reporting et exports (écran 10), vue consolidée (écran 11).
// Les données de démonstration de CX Expertise sont lues sans être modifiées ; les
// écritures sur les projets passent par la division de test (prisma/e2e-fixtures.ts).
const SAMUEL = "samuel.etoga@exemple.com";
const OWNER = "brigitte.mbarga@exemple.com";
const AICHA = "aicha.ndongo@exemple.com";
const MARTIN = "manager.e2e@exemple.com";

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Écrans de pilotage : desktop (§19, vues 375 px au jalon 8)");
test.describe.configure({ mode: "serial" });

async function open(page: Page, email: string, path: string, title: string) {
  await login(page, email);
  await expect(page).not.toHaveURL(/\/connexion/);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}

const row = (page: Page, name: string) => page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${name}`) }) });

test("projets de démonstration : liste, filtres et affichage dans l'adresse, colonnes, axe", async ({ page }) => {
  await open(page, SAMUEL, "/projets", "Projets");
  await expect(page.getByText("7 projets · 4 en cours")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tous (7)" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".btn-primary:visible")).toHaveCount(1);
  await expect(row(page, "Veille et formation")).toContainText("Toute l'année 2026");
  await expect(row(page, "Refonte parcours souscription")).toContainText("Budget dépassé de 10 h");
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
  await login(page, AICHA);
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  expect((await page.goto("/projets"))?.status()).toBe(404);
});

test("projets : création avec erreurs, statut avec « Annuler », archivage", async ({ page }) => {
  await open(page, MARTIN, "/projets", "Projets");
  await expect(page.getByText("3 projets · 2 en cours")).toBeVisible();

  // Panneau de création : erreurs sous les champs, focus sur la première.
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  const panel = page.getByRole("dialog", { name: "Nouveau projet" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("group", { name: "Membres affectés (0 sur 7)" })).toBeVisible();
  await panel.getByRole("button", { name: "Créer le projet" }).click();
  await expect(panel.getByText("Saisissez le nom du projet.")).toBeVisible();
  await expect(panel.getByLabel("Nom du projet")).toBeFocused();
  expect(await axe(page)).toEqual([]);

  await panel.getByLabel("Nom du projet").fill("Projet de test e2e");
  await panel.getByLabel("Date de début").fill("01/04/2026");
  await panel.getByLabel("Date de fin").fill("31/03/2026");
  await panel.getByLabel("Statut").selectOption({ label: "En cours" });
  await panel.getByLabel("Budget d'heures").fill("120");
  await panel.getByRole("button", { name: "Créer le projet" }).click();
  await expect(panel.getByText("Saisissez une date de fin au format jj/mm/aaaa, après la date de début.")).toBeVisible();
  await expect(panel.getByText("Ajoutez au moins une activité.")).toBeVisible();
  await panel.getByLabel("Date de fin").fill("30/06/2026");
  await panel.getByPlaceholder("Nouvelle activité").fill("Analyse");
  await panel.getByRole("button", { name: "Ajouter" }).click();
  await expect(panel.getByRole("button", { name: "Retirer l'activité Analyse" })).toBeVisible();
  await panel.getByLabel("Alice Essai").check();
  await expect(panel.getByRole("group", { name: "Membres affectés (1 sur 7)" })).toBeVisible();
  await panel.getByRole("button", { name: "Créer le projet" }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Projet « Projet de test e2e » créé avec le statut « En cours »." })).toBeVisible();
  await expect(row(page, "Projet de test e2e")).toContainText("0 / 120 h · 0 %");
  await expect(page.getByText("4 projets · 3 en cours")).toBeVisible();

  // Statut : changement immédiat, puis « Annuler ».
  const trigger = () => row(page, "Tests d'usage appli mobile").getByRole("button", { name: /^Statut de Tests d'usage appli mobile/ });
  await trigger().click();
  await page.getByRole("list", { name: "Changer le statut" }).getByRole("button", { name: "En pause" }).click();
  const notice = page.getByRole("status").filter({ hasText: "« Tests d'usage appli mobile » est passé à « En pause »." });
  await expect(notice).toContainText("La saisie des temps y est fermée.");
  await expect(trigger()).toHaveAccessibleName(/En pause/);
  await notice.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Changement annulé." })).toBeVisible();
  await expect(trigger()).toHaveAccessibleName(/Terminé/);

  // Archivage : le projet quitte la liste, l'interrupteur le fait revenir.
  await page.getByRole("button", { name: "Modifier Projet de test e2e" }).click();
  const edit = page.getByRole("dialog", { name: "Modifier le projet" });
  await expect(edit.getByLabel("Nom du projet")).toHaveValue("Projet de test e2e");
  await edit.getByRole("button", { name: "Archiver le projet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Projet « Projet de test e2e » archivé. Il n'apparaît plus dans la liste." })).toBeVisible();
  await expect(row(page, "Projet de test e2e")).toHaveCount(0);
  // L'interrupteur suit l'adresse : il est coché une fois la navigation faite.
  const archived = page.getByRole("switch", { name: "Afficher les projets archivés" });
  await archived.click();
  await expect(page).toHaveURL(/archives=1/);
  await expect(archived).toBeChecked();
  await expect(row(page, "Projet de test e2e")).toContainText("Archivé");
});

test("reporting : indicateurs, axes et périmètre dans l'adresse, exports CSV, Excel et PDF", async ({ page }) => {
  await open(page, SAMUEL, "/reporting?de=2026-10&a=2026-12", "Reporting");
  await expect(page.getByLabel("De la semaine")).toHaveValue("2026-10");
  await expect(page.getByLabel("À la semaine")).toHaveValue("2026-12");
  const kpis = page.getByRole("list", { name: "Indicateurs de la période" });
  await expect(kpis).toContainText("Heures saisies");
  await expect(kpis).toContainText("sur 720 h de capacité (6 personnes, 3 semaines)");
  await expect(page.getByRole("figure", { name: "Heures par projet, du 2 au 20 mars 2026" })).toBeVisible();
  const detail = page.getByRole("table", { name: "Heures par projet du 2 au 20 mars 2026" });
  await expect(detail.locator("tbody").getByRole("rowheader")).toHaveCount(4);
  await expect(detail.locator("tfoot").getByRole("rowheader")).toHaveText("Total");
  expect(await axe(page)).toEqual([]);

  await page.getByRole("button", { name: "Personne" }).click();
  await expect(page).toHaveURL(/axe=person/);
  await expect(page.getByRole("heading", { name: "Détail par personne" })).toBeVisible();
  await page.getByLabel("Périmètre").selectOption({ label: "Aïcha Ndongo" });
  await expect(page).toHaveURL(/personne=/);
  await expect(page.getByRole("table", { name: /^Heures par personne/ }).locator("tbody").getByRole("rowheader")).toHaveText(["Aïcha Ndongo"]);

  // Exports : mêmes filtres que l'écran.
  await page.getByRole("button", { name: "Exporter" }).click();
  const menu = page.getByRole("list", { name: "Formats d'export" });
  const csvHref = await menu.getByRole("link", { name: "CSV" }).getAttribute("href");
  expect(csvHref).toMatch(/axe=person/);
  expect(csvHref).toMatch(/personne=/);
  for (const [format, type] of [["csv", "text/csv"], ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], ["pdf", "application/pdf"]] as const) {
    const href = csvHref!.replace("format=csv", `format=${format}`);
    const r = await page.request.get(href);
    expect(r.status(), format).toBe(200);
    expect(r.headers()["content-type"]).toContain(type);
    expect(r.headers()["content-disposition"]).toBe(`attachment; filename="Reporting_2026-S10_2026-S12.${format}"`);
    const body = await r.body();
    if (format === "csv") expect(body.toString("utf8")).toContain("Aïcha Ndongo");
    if (format === "xlsx") expect(body.subarray(0, 2).toString()).toBe("PK");
    if (format === "pdf") expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  }

  // Sans la permission : ni l'écran, ni les exports.
  await page.context().clearCookies();
  await login(page, AICHA);
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  expect((await page.goto("/reporting"))?.status()).toBe(404);
  expect((await page.request.get("/reporting/export?format=csv")).status()).toBe(404);
});

test("vue division : indicateurs, équipes, tendance, dérives, semaine précédente", async ({ page }) => {
  await open(page, OWNER, "/division", "Division CX Expertise");
  await expect(page.getByText("3 équipes · 15 collaborateurs")).toBeVisible();
  const kpis = page.getByRole("list", { name: "Indicateurs de la semaine 12" });
  for (const label of ["Taux de remplissage", "Fiches soumises", "Fiches validées", "Dérives à traiter"]) await expect(kpis).toContainText(label);
  const teams = page.getByRole("table", { name: "Remplissage, soumission et validation par équipe" });
  for (const name of ["Parcours", "Études", "Data CX", "Division"]) await expect(teams.getByRole("rowheader", { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(teams).toContainText("Sous le seuil de 80 %");
  const drifts = page.getByRole("table", { name: "Dérives détectées dans la division" });
  await expect(drifts).toContainText("Budget dépassé");
  await expect(drifts).toContainText("Validation en retard");
  await expect(drifts).toContainText("Saisie manquante");
  await expect(page.getByRole("button", { name: /Semaine suivante indisponible/ })).toBeDisabled();
  expect(await axe(page)).toEqual([]);

  // « Voir le projet » ouvre le panneau du projet dans l'écran Projets.
  await drifts.getByRole("row").filter({ hasText: "Refonte parcours souscription" }).getByRole("link", { name: "Voir le projet" }).click();
  await expect(page).toHaveURL(/\/projets\?projet=/);
  await expect(page.getByRole("dialog", { name: "Modifier le projet" }).getByLabel("Nom du projet")).toHaveValue("Refonte parcours souscription");

  await page.goto("/division");
  await page.getByRole("button", { name: "Semaine précédente : semaine 11" }).click();
  await expect(page).toHaveURL(/annee=2026&semaine=11/);
  await expect(page.getByRole("list", { name: "Indicateurs de la semaine 11" })).toBeVisible();

  // Un manager n'a pas la vue division.
  await page.context().clearCookies();
  await login(page, SAMUEL);
  await expect(page).not.toHaveURL(/\/connexion/);
  expect((await page.goto("/division"))?.status()).toBe(404);
});
