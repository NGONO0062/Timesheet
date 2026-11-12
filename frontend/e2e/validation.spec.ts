import { expect, test, type Page } from "@playwright/test";
import { axe, signedIn } from "./helpers";

// Jalon 3 de la réécriture : file de validation (écran 07) et détail d'une fiche (écran 08),
// repris de e2e/validation.spec.ts avec la saisie par jour. La file de Samuel Etoga (CX
// Expertise) est lue sans être modifiée ; les décisions passent par la « Division de test »
// (Martin Valideur et ses collaborateurs *.e2e), remise à zéro avant les tests.
const SAMUEL = "samuel.etoga@exemple.com";
const MARTIN = "valideur.e2e@exemple.com";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

const desktop = () => test.skip(test.info().project.name !== "desktop", "Écrans manager : bureau ; le mobile est vérifié à part");

async function openQueue(page: Page, email: string) {
  await signedIn(page, email);
  await page.goto("/validation");
  await expect(page.getByRole("heading", { level: 1, name: "Fiches à valider" })).toBeVisible();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
}

const row = (page: Page, name: string) => page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${name}`) }) });

/** Dernier e-mail reçu par Mailpit pour cette adresse depuis `since`. */
async function lastMail(to: string, since: number): Promise<{ Subject: string } | null> {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  if (!r.ok) return null;
  const body = (await r.json()) as { messages: Array<{ Subject: string; Created: string }> };
  return body.messages.find((m) => Date.parse(m.Created) >= since - 5_000) ?? null;
}

test.describe("file de démonstration (lecture seule)", () => {
  test("quatre fiches en attente, étiquettes d'attention, sélection, filtres", async ({ page }) => {
    desktop();
    await openQueue(page, SAMUEL);
    await expect(page.getByText("4 en attente")).toBeVisible();
    await expect(page.getByRole("button", { name: "En attente (4)" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Validées (16)" })).toBeVisible();
    for (const name of ["Laure Bikoï", "Sandrine Mvondo", "Yannick Essomba", "Ibrahim Njoya"]) await expect(row(page, name)).toBeVisible();
    // Valider par exception (design v2, §6) : 2e soumission et commentaire d'Ibrahim, projet
    // inhabituel pour Laure ; pas de colonne Statut sous « En attente ».
    await expect(row(page, "Ibrahim Njoya").getByRole("rowheader")).toContainText("2e soumission");
    await expect(row(page, "Ibrahim Njoya").getByRole("rowheader")).toContainText("Commentaire");
    await expect(row(page, "Laure Bikoï").getByRole("rowheader")).toContainText("Projet inhabituel");
    await expect(row(page, "Yannick Essomba").getByRole("rowheader")).toHaveText("Yannick Essomba");
    await expect(page.getByRole("columnheader", { name: "Statut" })).toHaveCount(0);
    await expect(row(page, "Ibrahim Njoya")).toContainText("S11 · 9–13 mars");
    await expect(row(page, "Laure Bikoï")).toContainText("20 mars, 17:30");
    await expect(row(page, "Laure Bikoï")).toContainText("5 / 5");
    await expect(row(page, "Laure Bikoï").getByRole("link", { name: "Examiner" })).toBeVisible();
    // Aucune barre d'actions sans sélection.
    await expect(page.getByRole("region", { name: "Actions groupées" })).toHaveCount(0);
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

  test("détail : journées, commentaire, historique, Précédente / Suivante, motif requis", async ({ page }) => {
    desktop();
    await openQueue(page, SAMUEL);
    await row(page, "Ibrahim Njoya").getByRole("link", { name: "Examiner" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ibrahim Njoya · semaine 11" })).toBeVisible();
    await expect(page.getByText("Staff · 9–13 mars 2026 · soumise le 19 mars 2026 à 08:50")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Parcourir les fiches en attente" })).toContainText(/Fiche \d sur 4/);
    await expect(page.getByRole("table", { name: "Jours par projet, semaine 11 du 9 au 13 mars 2026, en lecture seule" })).toBeVisible();
    await expect(page.getByText("Journée de formation du vendredi ajoutée, comme demandé.")).toBeVisible();
    const history = page.locator("section[aria-labelledby='titre-histo'] li");
    await expect(history).toHaveText([/Soumise par Ibrahim Njoya/, /Rejetée par Samuel Etoga/, /Soumise par Ibrahim Njoya/, /Brouillon créé/]);
    // Valider par défaut ; Rejeter : motif requis, journées signalables.
    await expect(page.getByRole("button", { name: "Valider la fiche" })).toBeVisible();
    await page.getByLabel("Rejeter la fiche").check();
    await expect(page.getByLabel("Motif du rejet")).toHaveAttribute("aria-required", "true");
    await expect(page.getByRole("button", { name: /^Signaler la journée du Mercredi 11 mars/ })).toHaveAttribute("aria-pressed", "false");
    expect(await axe(page)).toEqual([]);
    await page.getByRole("button", { name: "Rejeter la fiche" }).click();
    await expect(page.getByText("Saisissez le motif du rejet.")).toBeVisible();
    await expect(page.getByLabel("Motif du rejet")).toBeFocused();
    // Rien n'est parti : on quitte sans décider.
    await page.getByRole("link", { name: "Annuler" }).click();
    await expect(page).toHaveURL(/\/validation$/);
    await expect(page.getByText("4 en attente")).toBeVisible();
  });
});

test.describe("décisions (division de test)", () => {
  test.describe.configure({ mode: "serial" });

  test("validation et rejet groupés, e-mails aux collaborateurs", async ({ page }) => {
    desktop();
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

  test("détail : rejet avec journée signalée, fiche suivante, vue de la collaboratrice", async ({ page }) => {
    desktop();
    await openQueue(page, MARTIN);
    await row(page, "Chloé Essai").getByRole("link", { name: "Examiner" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Chloé Essai · semaine 12" })).toBeVisible();
    await page.getByLabel("Rejeter la fiche").check();
    const day = page.getByRole("button", { name: /^Signaler la journée du Jeudi 19 mars/ });
    await day.click();
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 journée signalée.")).toBeVisible();
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

    // Côté collaboratrice : bandeau de rejet et journée signalée (écran 05).
    await page.context().clearCookies();
    await signedIn(page, "chloe.e2e@exemple.com");
    await expect(page.getByText("Semaine 12 rejetée par Martin Valideur")).toBeVisible();
    await page.goto("/saisie/2026/12");
    await expect(page.getByRole("alert").filter({ hasText: "Fiche rejetée par Martin Valideur" })).toContainText("Motif : « Jeudi 19 : la réunion était annulée. »");
    await expect(page.getByLabel(/Jeudi 19 mars : projet et activité/)).toHaveAttribute("aria-invalid", "true");
  });
});

test("accès : la file n'existe pas sans la permission, la tâche de relance exige son secret", async ({ page, request }) => {
  await signedIn(page, "aicha.ndongo@exemple.com");
  await page.goto("/validation");
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  expect((await request.get("/api/v1/validation")).status()).toBe(401);
  expect((await request.post("/api/v1/taches/relances")).status()).toBe(401);
  expect((await request.post("/api/v1/taches/relances", { headers: { Authorization: "Bearer faux" } })).status()).toBe(401);
});

test("mobile 375 : une fiche par ligne, sélection, sans défilement horizontal", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile seulement");
  await openQueue(page, SAMUEL);
  const list = page.getByRole("list", { name: "Fiches de temps en attente de validation" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(list.getByRole("listitem").filter({ hasText: "Ibrahim Njoya" })).toContainText("2e soumission");
  await page.getByRole("checkbox", { name: "Sélectionner toutes les fiches" }).check();
  await expect(page.getByRole("region", { name: "Actions groupées" }).getByRole("status")).toHaveText("4 fiches sélectionnées");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect(await axe(page)).toEqual([]);
  await list.getByRole("link", { name: "Laure Bikoï" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Laure Bikoï · semaine 12" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

// Circuit à deux étapes (point 52) : division à part, dont le réglage demande l'owner (N+2).
test.describe("circuit à deux étapes (division de test)", () => {
  test("le manager valide et transmet, l'owner donne la validation finale", async ({ page }) => {
    desktop();
    await openQueue(page, "n1.e2e@exemple.com");
    await row(page, "Elsa Étape").getByRole("link", { name: "Examiner" }).click();
    await page.getByRole("button", { name: "Valider la fiche" }).click();
    await expect(page.getByText("Fiche validée et transmise à l'owner (N+2) pour la validation finale.")).toBeVisible();

    // La fiche reste « En attente de validation », mais elle n'est plus à Nadia : elle se consulte.
    await page.getByRole("button", { name: /^Toutes/ }).click();
    const elsa = row(page, "Elsa Étape");
    await expect(elsa).toContainText("Validée par Nadia Niveau (N+1)");
    await expect(elsa).toContainText("En attente de validation");
    await elsa.getByRole("link", { name: "Consulter" }).click();
    await expect(page.getByText(/Elle attend la validation de l'owner \(N\+2\)\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Valider la fiche" })).toHaveCount(0);
    expect(await axe(page)).toEqual([]);

    // La collaboratrice voit où en est sa fiche.
    await page.context().clearCookies();
    await signedIn(page, "etape.e2e@exemple.com");
    await page.goto("/saisie/2026/12");
    await expect(page.getByText(/Validée par Nadia Niveau le .*En attente de la validation de l'owner \(N\+2\)\./)).toBeVisible();

    // L'owner donne la validation finale.
    await page.context().clearCookies();
    await openQueue(page, "n2.e2e@exemple.com");
    await row(page, "Elsa Étape").getByRole("link", { name: "Examiner" }).click();
    await expect(page.getByText(/Validée par Nadia Niveau \(N\+1\) le .*Votre décision est la validation finale\./)).toBeVisible();
    await page.getByRole("button", { name: "Valider la fiche" }).click();
    await expect(page.getByText("Fiche validée. Le collaborateur est prévenu.")).toBeVisible();
  });
});
