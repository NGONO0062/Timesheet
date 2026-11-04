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
  await expect(row(page, "Refonte parcours souscription")).toContainText("Budget dépassé de 9 jours");
  await expect(row(page, "Refonte FAQ en ligne").getByRole("button", { name: "Statut de Refonte FAQ en ligne : En pause. Modifier" })).toBeVisible();
  await expect(row(page, "Cartographie des irritants")).toContainText("DMAIC · Analyser (3 sur 5)");
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
  await expect(page.getByText("4 projets · 2 en cours")).toBeVisible();

  // Panneau de création : erreurs sous les champs, focus sur la première.
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  const panel = page.getByRole("dialog", { name: "Nouveau projet" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("group", { name: "Membres affectés (0 sur 8)" })).toBeVisible();
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
  await expect(panel.getByRole("group", { name: "Membres affectés (1 sur 8)" })).toBeVisible();
  await panel.getByRole("button", { name: "Créer le projet" }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Projet « Projet de test e2e » créé avec le statut « En cours »." })).toBeVisible();
  await expect(row(page, "Projet de test e2e")).toContainText("0 / 30 jours · 0 %");
  await expect(page.getByText("5 projets · 3 en cours")).toBeVisible();

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

  // Vue en colonnes : glisser la carte change le statut, avec le même « Annuler ».
  await page.getByRole("button", { name: "Colonnes" }).click();
  await expect(page).toHaveURL(/vue=colonnes/);
  const card = page.locator("article", { hasText: "Tests d'usage appli mobile" });
  await card.dragTo(page.getByRole("region", { name: /^En pause, 0 projet$/ }));
  const dropped = page.getByRole("status").filter({ hasText: "« Tests d'usage appli mobile » est passé à « En pause »." });
  await expect(dropped).toBeVisible();
  await expect(page.getByRole("region", { name: /^En pause, 1 projet$/ })).toContainText("Tests d'usage appli mobile");
  await dropped.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Changement annulé." })).toBeVisible();
  await expect(page.getByRole("region", { name: /^Terminé, 1 projet$/ })).toContainText("Tests d'usage appli mobile");
  await page.getByRole("button", { name: "Liste" }).click();

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

test("projets DMAIC : type de projet, phase changée tout de suite avec « Annuler »", async ({ page }) => {
  // Le projet du test précédent, archivé, devient DMAIC : aucun projet de plus dans la division de test.
  await open(page, MARTIN, "/projets?archives=1", "Projets");
  await page.getByRole("button", { name: "Modifier Projet de test e2e" }).click();
  const edit = page.getByRole("dialog", { name: "Modifier le projet" });
  await expect(edit.getByLabel("Type de projet")).toHaveValue("STANDARD");
  await expect(edit.getByRole("region", { name: "Phase DMAIC" })).toHaveCount(0);
  await edit.getByLabel("Type de projet").selectOption({ label: "DMAIC" });
  await expect(edit.getByText("Le projet commencera par la phase « Définir ».")).toBeVisible();
  await edit.getByRole("button", { name: "Enregistrer" }).click();
  await expect(edit).toBeHidden();
  await expect(row(page, "Projet de test e2e")).toContainText("DMAIC · Définir (1 sur 5)");

  await page.getByRole("button", { name: "Modifier Projet de test e2e" }).click();
  const phase = edit.getByRole("region", { name: "Phase DMAIC" });
  await expect(phase).toContainText("Phase 1 sur 5 : Définir");
  await expect(phase.getByRole("list", { name: "Phases du projet DMAIC" }).locator("[aria-current='step']")).toHaveText("Définir");
  await expect(phase.getByRole("button", { name: /^Revenir/ })).toHaveCount(0);
  await phase.getByRole("button", { name: "Passer à la phase « Mesurer »" }).click();
  const notice = phase.getByRole("status").filter({ hasText: "« Projet de test e2e » est passé à la phase « Mesurer »." });
  await expect(notice).toBeVisible();
  await expect(phase).toContainText("Phase 2 sur 5 : Mesurer");
  expect(await axe(page)).toEqual([]);
  await notice.getByRole("button", { name: "Annuler" }).click();
  await expect(phase.getByRole("status").filter({ hasText: "Changement annulé." })).toBeVisible();
  await expect(phase).toContainText("Phase 1 sur 5 : Définir");
  await phase.getByRole("button", { name: "Passer à la phase « Mesurer »" }).click();
  await expect(phase.getByRole("button", { name: "Revenir à la phase « Définir »" })).toBeVisible();
  await edit.getByRole("button", { name: "Fermer le panneau" }).click();
  await expect(row(page, "Projet de test e2e")).toContainText("DMAIC · Mesurer (2 sur 5)");
});

test("suivi DMAIC : sponsor, revue de passage, livrables et indicateur", async ({ page }) => {
  // Le projet DMAIC du test précédent, en phase « Mesurer ». Martin en devient le sponsor :
  // il demande la revue, puis la décide (un sponsor peut aussi gérer le projet).
  await open(page, MARTIN, "/projets?archives=1", "Projets");
  await page.getByRole("button", { name: "Modifier Projet de test e2e" }).click();
  const edit = page.getByRole("dialog", { name: "Modifier le projet" });
  await expect(edit.getByLabel("Sponsor")).toHaveValue("");
  await edit.getByLabel("Sponsor").selectOption({ label: "Martin Valideur" });
  await edit.getByRole("button", { name: "Enregistrer" }).click();
  await expect(edit).toBeHidden();
  await page.getByRole("button", { name: "Modifier Projet de test e2e" }).click();
  const phase = edit.getByRole("region", { name: "Phase DMAIC" });
  await expect(phase.getByRole("button", { name: /^Passer à la phase/ })).toHaveCount(0);
  await expect(phase).toContainText("Avec un sponsor, on entre dans la phase « Analyser » par une revue de passage.");
  await phase.getByRole("link", { name: "Suivi DMAIC" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Projet de test e2e" })).toBeVisible();
  await expect(page.getByText("Phase 2 sur 5 : Mesurer")).toBeVisible();
  // Projet archivé au test précédent : le suivi se lit sans se modifier.
  await expect(page.getByText("Ce projet est archivé : son suivi reste lisible, il ne se modifie plus.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Demander la revue de passage" })).toHaveCount(0);
  expect(await axe(page)).toEqual([]);

  await page.getByRole("navigation", { name: "Fil d'Ariane" }).getByRole("link", { name: "Projets" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Projets" })).toBeVisible();
  await page.goto("/projets?archives=1");
  await page.getByRole("button", { name: "Modifier Projet de test e2e" }).click();
  await edit.getByRole("button", { name: "Sortir des archives" }).click();
  await expect(edit).toBeHidden();
  await page.getByRole("link", { name: "Suivi DMAIC de Projet de test e2e" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Projet de test e2e" })).toBeVisible();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
  const review = page.getByRole("region", { name: "Revue de passage" });
  await expect(review).toContainText("Aucune revue demandée pour la phase « Mesurer ».");
  await expect(review).toContainText("Livrables de la phase : 0 sur 3.");

  // Livrable coché tout de suite, avec « Annuler ».
  const deliverables = page.getByRole("region", { name: "Livrables types" });
  await deliverables.getByLabel("Plan de collecte des données").check();
  const done = page.getByRole("status").filter({ hasText: "Livrable « Plan de collecte des données » marqué comme fait." });
  await expect(done).toBeVisible();
  await expect(deliverables.getByRole("group", { name: /^Mesurer · 1 sur 3/ })).toBeVisible();
  await done.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Changement annulé." })).toBeVisible();
  await expect(deliverables.getByLabel("Plan de collecte des données")).not.toBeChecked();
  await deliverables.getByLabel("Performance de départ mesurée").check();
  await expect(review).toContainText("Livrables de la phase : 1 sur 3.");

  // Indicateur : erreurs sous les champs, puis l'écart comblé.
  const indicator = page.getByRole("region", { name: "Indicateur du projet" });
  await indicator.getByLabel("Valeur de départ").fill("douze");
  await indicator.getByRole("button", { name: "Enregistrer l'indicateur" }).click();
  await expect(indicator.getByText("Saisissez le nom de l'indicateur.")).toBeVisible();
  await expect(indicator.getByLabel("Indicateur", { exact: true })).toBeFocused();
  await indicator.getByLabel("Indicateur", { exact: true }).fill("Délai de réponse");
  await indicator.getByLabel("Unité").fill("jours");
  await indicator.getByLabel("Valeur de départ").fill("12");
  await indicator.getByLabel("Cible").fill("4");
  await indicator.getByLabel("Valeur atteinte").fill("8");
  await indicator.getByRole("button", { name: "Enregistrer l'indicateur" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Indicateur enregistré." })).toBeVisible();
  await expect(indicator).toContainText("Objectif : baisser de 12\u00a0jours à 4\u00a0jours.");
  await expect(indicator).toContainText("50\u00a0% de l'écart comblé");
  await expect(indicator.getByRole("progressbar", { name: "Écart comblé, Délai de réponse" })).toHaveAttribute("aria-valuenow", "50");

  // Revue demandée : un seul bouton primaire, puis la décision du sponsor.
  await expect(page.locator(".btn-primary:visible")).toHaveCount(1);
  await review.getByLabel("Message au sponsor").fill("Mesure faite sur un mois.");
  await review.getByRole("button", { name: "Demander la revue de passage" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Revue de passage de la phase « Mesurer » demandée. Martin Valideur est prévenu par e-mail." })).toBeVisible();
  await expect(review).toContainText("Elle attend la décision de Martin Valideur.");
  await expect(page.locator(".btn-primary:visible")).toHaveCount(1);
  await expect(page).toHaveTitle(/^Suivi DMAIC/);
  expect(await axe(page)).toEqual([]);

  await review.getByLabel("Demander des compléments").check();
  await review.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(review.getByText("Dites quels compléments vous attendez.")).toBeVisible();
  await expect(review.getByLabel("Compléments attendus")).toBeFocused();
  await review.getByLabel("Compléments attendus").fill("Ajoutez la validation du système de mesure.");
  await review.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Compléments demandés. Martin Valideur est prévenu par e-mail." })).toBeVisible();
  await expect(review).toContainText("« Ajoutez la validation du système de mesure. »");
  await expect(review.getByRole("table", { name: "Revues de passage du projet" }).getByRole("row")).toHaveCount(2);

  await review.getByRole("button", { name: "Demander de nouveau la revue" }).click();
  await expect(review.getByLabel("Accorder le passage")).toBeChecked();
  await expect(review).toContainText("Le projet entre tout de suite dans la phase « Analyser ».");
  await review.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Passage accordé : « Projet de test e2e » entre dans la phase « Analyser »." })).toBeVisible();
  await expect(page.getByText("Phase 3 sur 5 : Analyser")).toBeVisible();
  await expect(review).toContainText("Aucune revue demandée pour la phase « Analyser ».");

  await page.goto("/projets");
  await expect(row(page, "Projet de test e2e")).toContainText("DMAIC · Analyser (3 sur 5)");
});

test("suivi DMAIC de démonstration : le sponsor lit l'historique des revues ; hors portée, 404", async ({ page }) => {
  await open(page, OWNER, "/projets", "Projets");
  await page.getByRole("link", { name: "Suivi DMAIC de Cartographie des irritants" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cartographie des irritants" })).toBeVisible();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
  await expect(page.getByText("Sponsor : Brigitte Mbarga")).toBeVisible();
  const review = page.getByRole("region", { name: "Revue de passage" });
  await expect(review).toContainText("Aucune revue demandée pour la phase « Analyser ».");
  await expect(review.getByRole("table", { name: "Revues de passage du projet" }).getByRole("row")).toHaveCount(4);
  await expect(review).toContainText("Compléments demandés par Brigitte Mbarga, le 11 mars 2026");
  await expect(page.getByRole("region", { name: "Livrables types" }).getByRole("group", { name: /^Définir · 3 sur 3/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Indicateur du projet" })).toContainText("Départ 12\u00a0jours · Cible 5\u00a0jours · Atteint 11\u00a0jours");
  expect(await axe(page)).toEqual([]);
  const url = page.url();

  // Un manager de la division de test n'atteint pas ce projet.
  await page.context().clearCookies();
  await login(page, MARTIN);
  await expect(page).not.toHaveURL(/\/connexion/);
  expect((await page.goto(new URL(url).pathname))?.status()).toBe(404);
});

test("reporting : indicateurs, axes et périmètre dans l'adresse, exports CSV, Excel et PDF", async ({ page }) => {
  await open(page, SAMUEL, "/reporting?de=2026-10&a=2026-12", "Reporting");
  await expect(page.getByLabel("De la semaine")).toHaveValue("2026-10");
  await expect(page.getByLabel("À la semaine")).toHaveValue("2026-12");
  const kpis = page.getByRole("list", { name: "Indicateurs de la période" });
  await expect(kpis).toContainText("Jours saisis");
  await expect(kpis).toContainText("sur 90 jours de capacité (6 personnes, 3 semaines)");
  await expect(page.getByRole("figure", { name: "Jours par projet, du 2 au 20 mars 2026" })).toBeVisible();
  const detail = page.getByRole("table", { name: "Jours par projet du 2 au 20 mars 2026" });
  await expect(detail.locator("tbody").getByRole("rowheader")).toHaveCount(4);
  await expect(detail.locator("tfoot").getByRole("rowheader")).toHaveText("Total");
  // Projet DMAIC : jours par phase (Mesurer jusqu'au 13 mars, Analyser depuis le 16).
  const phases = page.getByRole("table", { name: "Jours saisis sur les projets DMAIC, par phase, du 2 au 20 mars 2026" });
  await expect(phases.getByRole("columnheader")).toHaveText(["Projet", "Code", "Définir", "Mesurer", "Analyser", "Améliorer", "Contrôler", "Total"]);
  await expect(phases.locator("tbody").getByRole("rowheader")).toHaveText(["Cartographie des irritants"]);
  expect(await axe(page)).toEqual([]);

  await page.getByRole("button", { name: "Personne" }).click();
  await expect(page).toHaveURL(/axe=person/);
  await expect(page.getByRole("heading", { name: "Détail par personne" })).toBeVisible();
  await page.getByLabel("Périmètre").selectOption({ label: "Aïcha Ndongo" });
  await expect(page).toHaveURL(/personne=/);
  await expect(page.getByRole("table", { name: /^Jours par personne/ }).locator("tbody").getByRole("rowheader")).toHaveText(["Aïcha Ndongo"]);

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
  test.setTimeout(90_000); // parcours long : trois connexions (owner, manager, owner)
  await open(page, OWNER, "/division", "Division CX Expertise");
  // 15 collaborateurs au seed ; la démonstration peut en avoir ajouté.
  await expect(page.getByText(/^3 équipes · 1[5-9] collaborateurs$/)).toBeVisible();
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
