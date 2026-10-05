import { expect, test, type Page } from "@playwright/test";
import { axe, login } from "./helpers";

// Jalon 3 : file de validation (écran 7) et détail d'une fiche (écran 8).
// La file de Samuel Etoga (données de démonstration) est lue sans être modifiée ;
// les décisions passent par la division de test (prisma/e2e-fixtures.ts).
const SAMUEL = "samuel.etoga@exemple.com";
const MARTIN = "manager.e2e@exemple.com";
const CHLOE = "chloe.e2e@exemple.com";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Écrans manager : desktop (§19, vues 375 px au jalon 8)");
test.describe.configure({ mode: "serial" });

async function openQueue(page: Page, email: string) {
  await login(page, email);
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  await page.goto("/validation");
  await expect(page.getByRole("heading", { level: 1, name: "Fiches à valider" })).toBeVisible();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}

const row = (page: Page, name: string) => page.getByRole("row").filter({ has: page.getByRole("rowheader", { name, exact: true }) });

/** Dernier e-mail reçu par Mailpit pour cette adresse depuis `since`. */
async function lastMail(to: string, since: number): Promise<{ Subject: string } | null> {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  if (!r.ok) return null;
  const body = (await r.json()) as { messages: Array<{ Subject: string; Created: string }> };
  return body.messages.find((m) => Date.parse(m.Created) >= since - 5_000) ?? null;
}

test("file de démonstration : quatre fiches en attente, 2e soumission, filtres, axe", async ({ page }) => {
  await openQueue(page, SAMUEL);
  await expect(page.getByText("4 en attente")).toBeVisible();
  await expect(page.getByRole("button", { name: "En attente (4)" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Validées (16)" })).toBeVisible();
  for (const name of ["Laure Bikoï", "Sandrine Mvondo", "Yannick Essomba", "Ibrahim Njoya"]) await expect(row(page, name)).toBeVisible();
  await expect(row(page, "Ibrahim Njoya")).toContainText("S11 · 9–13 mars");
  await expect(row(page, "Ibrahim Njoya")).toContainText("2e soumission");
  await expect(row(page, "Laure Bikoï")).toContainText("20 mars, 17:30");
  await expect(row(page, "Laure Bikoï").getByRole("link", { name: "Examiner" })).toBeVisible();
  // Aucune barre d'actions sans sélection, aucun bouton primaire.
  await expect(page.getByRole("region", { name: "Actions groupées" })).toHaveCount(0);
  await expect(page.locator(".btn-primary:visible")).toHaveCount(0);
  expect(await axe(page)).toEqual([]);

  // La sélection fait apparaître la barre, avec le compte annoncé.
  await page.getByRole("checkbox", { name: "Sélectionner la fiche de Laure Bikoï, S12 · 16–20 mars" }).check();
  const bar = page.getByRole("region", { name: "Actions groupées" });
  await expect(bar.getByRole("status")).toHaveText("1 fiche sélectionnée");
  await page.getByRole("checkbox", { name: "Sélectionner toutes les fiches" }).check();
  await expect(bar.getByRole("status")).toHaveText("4 fiches sélectionnées");
  expect(await axe(page)).toEqual([]);
  await bar.getByRole("button", { name: "Tout désélectionner" }).click();
  await expect(bar).toHaveCount(0);

  // Filtres : dans l'adresse.
  await page.getByLabel("Personne").selectOption({ label: "Ibrahim Njoya" });
  await expect(page).toHaveURL(/personne=/);
  await expect(page.getByRole("button", { name: "En attente (1)" })).toBeVisible();
  await page.getByLabel("Période").selectOption({ label: "Semaine 12 · 16–20 mars 2026" });
  await expect(page.getByRole("heading", { name: "Aucune fiche en attente" })).toBeVisible();
  await page.getByRole("button", { name: "Réinitialiser les filtres" }).click();
  await expect(page).toHaveURL(/\/validation$/);
  await page.getByRole("button", { name: /^Rejetées/ }).click();
  await expect(row(page, "Kevin Fotso")).toContainText("Rejetée");
  await expect(row(page, "Kevin Fotso").getByRole("link", { name: "Consulter" })).toBeVisible();
});

test("détail de démonstration : grille, commentaire, historique, Précédente / Suivante", async ({ page }) => {
  await openQueue(page, SAMUEL);
  await row(page, "Ibrahim Njoya").getByRole("link", { name: "Examiner" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ibrahim Njoya · semaine 11" })).toBeVisible();
  await expect(page.getByText("Staff · 9–13 mars 2026 · soumise le 19 mars 2026 à 08:50")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Parcourir les fiches en attente" })).toContainText(/Fiche \d sur 4/);
  await expect(page.getByRole("table", { name: "Heures par projet et par jour, semaine 11 du 9 au 13 mars 2026, en lecture seule" })).toBeVisible();
  await expect(page.getByText("Heures du mercredi réparties entre les tests et la formation, comme demandé.")).toBeVisible();
  const history = page.locator("section[aria-labelledby='titre-histo'] li");
  await expect(history).toHaveText([/Soumise par Ibrahim Njoya/, /Rejetée par Samuel Etoga/, /Soumise par Ibrahim Njoya/, /Brouillon créé/]);
  // Valider par défaut : un seul bouton primaire. Rejeter : bouton danger, motif requis.
  await expect(page.locator(".btn-primary:visible")).toHaveCount(1);
  await page.getByLabel("Rejeter la fiche").check();
  await expect(page.getByLabel("Motif du rejet")).toHaveAttribute("aria-required", "true");
  await expect(page.locator(".btn-primary:visible")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Signaler la cellule Refonte parcours souscription, mercredi 11/ })).toHaveAttribute("aria-pressed", "false");
  expect(await axe(page)).toEqual([]);
  await page.getByRole("button", { name: "Rejeter la fiche" }).click();
  await expect(page.getByText("Saisissez le motif du rejet.")).toBeVisible();
  await expect(page.getByLabel("Motif du rejet")).toBeFocused();
  // Rien n'est parti : on quitte sans décider.
  await page.getByRole("link", { name: "Annuler" }).click();
  await expect(page).toHaveURL(/\/validation$/);
  await expect(page.getByText("4 en attente")).toBeVisible();
});

test("validation et rejet groupés, e-mails aux collaborateurs", async ({ page }) => {
  const since = Date.now();
  await openQueue(page, MARTIN);
  await page.getByRole("checkbox", { name: /^Sélectionner la fiche de Alice Essai/ }).check();
  await page.getByRole("button", { name: "Valider la sélection" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 fiche validée. Le collaborateur est prévenu." })).toBeVisible();
  await expect(row(page, "Alice Essai")).toHaveCount(0);

  await page.getByRole("checkbox", { name: /^Sélectionner la fiche de Bruno Essai/ }).check();
  await page.getByRole("button", { name: "Rejeter la sélection" }).click();
  const dialog = page.getByRole("dialog", { name: "Rejeter 1 fiche ?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Rejeter", exact: true }).click();
  await expect(dialog.getByText("Saisissez le motif du rejet.")).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await dialog.getByLabel("Motif commun du rejet").fill("Merci de détailler la formation.");
  await dialog.getByRole("button", { name: "Rejeter", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "1 fiche rejetée. Elle repasse en saisie avec votre motif." })).toBeVisible();

  await page.getByRole("button", { name: /^Validées/ }).click();
  await expect(row(page, "Alice Essai")).toContainText("Validée");

  await expect.poll(async () => (await lastMail("alice.e2e@exemple.com", since))?.Subject, { timeout: 15_000 }).toBe("Semaine 12 validée");
  await expect.poll(async () => (await lastMail("bruno.e2e@exemple.com", since))?.Subject, { timeout: 15_000 }).toBe("Semaine 12 rejetée : à corriger");
});

test("détail : rejet avec cellule signalée, vue du collaborateur, puis validation suivante", async ({ page }) => {
  await openQueue(page, MARTIN);
  await row(page, "Chloé Essai").getByRole("link", { name: "Examiner" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Chloé Essai · semaine 12" })).toBeVisible();
  await page.getByLabel("Rejeter la fiche").check();
  const cell = page.getByRole("button", { name: /^Signaler la cellule Refonte parcours souscription, jeudi 19/ });
  await cell.click();
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1 cellule signalée.")).toBeVisible();
  await page.getByLabel("Motif du rejet").fill("Jeudi 19 : la réunion était annulée.");
  await page.getByRole("button", { name: "Rejeter la fiche" }).click();
  // On enchaîne sur la fiche en attente suivante, avec le résultat annoncé.
  await expect(page.getByRole("status").filter({ hasText: "Fiche rejetée. Elle repasse en saisie avec votre motif." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Chloé Essai · semaine 12");

  // David Essai, semaine 11 : validation depuis le détail.
  await page.goto("/validation");
  await row(page, "David Essai").getByRole("link", { name: "Examiner" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "David Essai · semaine 11" })).toBeVisible();
  await page.getByRole("button", { name: "Valider la fiche" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Fiche validée. Le collaborateur est prévenu." })).toBeVisible();

  // Côté collaborateur : bandeau de rejet et cellule signalée (écran 05).
  await page.context().clearCookies();
  await login(page, CHLOE);
  await expect(page.getByText("Semaine 12 rejetée par Martin Valideur")).toBeVisible();
  await page.goto("/saisie/2026/12");
  await expect(page.getByRole("alert").filter({ hasText: "Fiche rejetée par Martin Valideur" })).toContainText("Motif : « Jeudi 19 : la réunion était annulée. »");
  await expect(page.getByLabel("Refonte parcours souscription, jeudi 19, heures")).toHaveAttribute("aria-invalid", "true");
});

test("accès : la file n'existe pas sans la permission, la tâche de relance exige son secret", async ({ page, request }) => {
  await login(page, "aicha.ndongo@exemple.com");
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  expect((await page.goto("/validation"))?.status()).toBe(404);
  expect((await request.post("/api/taches/relances")).status()).toBe(401);
  expect((await request.post("/api/taches/relances", { headers: { Authorization: "Bearer faux" } })).status()).toBe(401);
});
