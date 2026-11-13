import { expect, test, type Page } from "@playwright/test";
import { axe, signedIn } from "./helpers";

// Jalon 7 de la réécriture : administration plateforme (écran 13, PROMPT.md §9.10 et §17,
// test 5), repris de e2e/plateforme.spec.ts. Lecture : divisions et journal du seed.
// Écriture : la division « e2e-nouvelle », créée par le test (base recréée à chaque exécution).
const ROSE = "rose.ekambi@exemple.com";
const ADMIN_EMAIL = "nadia.nouvelle.e2e@exemple.com";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.describe.configure({ mode: "serial" });
test.beforeEach(() => test.skip(test.info().project.name !== "desktop", "Administration plateforme : bureau (§19)"));

async function openPlatform(page: Page, path = "/plateforme") {
  await page.context().clearCookies();
  await signedIn(page, ROSE);
  await expect(page).toHaveURL(/\/plateforme$/);
  if (path !== "/plateforme") await page.goto(path);
  await expect(page.locator("[aria-busy]")).toHaveCount(0);
}

test("divisions et journal d'audit de la planche 13", async ({ page }) => {
  await openPlatform(page);
  await expect(page.getByRole("heading", { level: 1, name: "Divisions" })).toBeVisible();
  await expect(page.getByText("Chaque division est un tenant isolé : ses utilisateurs, ses rôles, ses règles et ses données ne sont jamais visibles depuis une autre division.")).toBeVisible();
  const divisions = page.getByRole("table", { name: "Divisions de la plateforme, avec leur administrateur, leur nombre d'utilisateurs et leur état" });
  const cx = divisions.getByRole("row", { name: /CX Expertise/ });
  await expect(cx).toContainText("Pilote");
  await expect(cx).toContainText("cx-expertise");
  await expect(cx).toContainText("Paul Tchouta");
  await expect(cx).toContainText(/(^|\D)2\d(\D|$)/); // 21 au seed
  await expect(cx).toContainText("Active");
  await expect(cx).toContainText("5 janv. 2026");
  const onboarding = divisions.getByRole("row", { name: /Expérience boutiques/ });
  await expect(onboarding).toContainText("À désigner");
  await expect(onboarding).toContainText("Onboarding · étape 2 sur 5");
  await expect(onboarding.getByRole("link", { name: "Reprendre l'onboarding de Expérience boutiques" })).toBeVisible();

  // Journal : semaine en cours par défaut, du plus récent au plus ancien.
  await expect(page.getByLabel("Du", { exact: true })).toHaveValue("16/03/2026");
  await expect(page.getByLabel("Au", { exact: true })).toHaveValue("20/03/2026");
  const log = page.getByRole("table", { name: "Événements du journal d'audit, du plus récent au plus ancien" });
  await expect(log.getByRole("row").nth(1)).toContainText("Yannick Essomba");
  await expect(log.getByRole("row").nth(1)).toContainText("Soumission de fiche");
  await expect(log.getByRole("row", { name: /Compte non identifié/ }).first()).toContainText("Échec");
  await expect(page.getByText(/^Événements 1 à 20 sur \d+$/)).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.getByLabel("Type d'action").selectOption({ label: "Règles et permissions" });
  await page.getByLabel("Acteur ou objet").fill("seuil");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/type=RULES/);
  await expect(log.getByRole("row", { name: /Paul Tchouta/ }).first()).toContainText("Seuil d'alerte de remplissage");

  await page.getByLabel("Du", { exact: true }).fill("31/02/2026");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page.getByText("Saisissez une date au format jj/mm/aaaa.")).toBeVisible();

  // Export : le fichier reprend les filtres de l'écran.
  const csv = await page.request.get("/api/v1/plateforme/journal/export?du=16/03/2026&au=20/03/2026&type=LOGIN&format=csv");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-disposition"]).toContain("filename=Journal_audit_2026-03-16_2026-03-20.csv");
  const text = await csv.text();
  expect(text.split("\n")[0]).toContain("Date et heure;Acteur;Rôle;Division;Action;Objet;Résultat");
  expect(text).toContain("Compte non identifié");
  expect(text).not.toContain("Soumission de fiche");

  // Le journal seul, depuis la navigation.
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Journal d'audit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Journal d'audit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exporter" })).toBeVisible();
});

test("onboarding d'une division, de l'identité à l'invitation (§17, test 5)", async ({ page }) => {
  test.setTimeout(120_000); // cinq étapes, puis l'e-mail d'invitation
  const since = Date.now();
  await openPlatform(page);
  await page.getByRole("link", { name: "Ajouter une division" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nouvelle division" })).toBeVisible();
  await expect(page.getByText("Étape 1 sur 5. Votre progression est enregistrée à chaque étape.")).toBeVisible();

  // Étape 1 : identité, identifiant proposé à partir du nom.
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Saisissez le nom de la division.")).toBeVisible();
  await expect(page.getByLabel("Nom de la division")).toBeFocused();
  await page.getByLabel("Nom de la division").fill("Division créée e2e");
  await expect(page.getByLabel("Identifiant du tenant")).toHaveValue("division-creee-e2e");
  await page.getByLabel("Identifiant du tenant").fill("cx-expertise");
  await page.getByLabel("Rattachement").fill("DEC");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Cet identifiant est déjà pris par une autre division.")).toBeVisible();
  await page.getByLabel("Identifiant du tenant").fill("e2e-nouvelle");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Étape 2 (planche 13-Onboarding-division) : « Enregistrer et quitter », puis reprise.
  await expect(page).toHaveURL(/etape=2$/);
  const card = page.getByRole("complementary").getByRole("region", { name: "Étape 1 · Identité" });
  await expect(card).toContainText("Division créée e2e");
  await expect(card).toContainText("e2e-nouvelle");
  await page.getByLabel("Nom complet").fill("Nadia Nouvelle");
  await page.getByLabel("Adresse e-mail professionnelle").fill(ADMIN_EMAIL);
  await expect(page.getByRole("radio", { name: "Reprendre la configuration de CX Expertise" })).toBeChecked();
  expect(await axe(page)).toEqual([]);
  await page.getByRole("button", { name: "Enregistrer et quitter" }).click();
  await expect(page).toHaveURL(/\/plateforme$/);
  await expect(page.getByRole("status").filter({ hasText: "Onboarding de Division créée e2e enregistré à l'étape 3 sur 5." })).toBeVisible();
  await page.getByRole("link", { name: "Reprendre l'onboarding de Division créée e2e" }).click();
  await expect(page.getByText("Étape 3 sur 5. Votre progression est enregistrée à chaque étape.")).toBeVisible();

  // Étape 3 : rôles et workflow.
  await expect(page.getByLabel("Adresse e-mail des RH")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Consulter le reporting : Staff" }).check();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Étape 4 : règles de saisie.
  await expect(page.getByText("Étape 4 sur 5. Votre progression est enregistrée à chaque étape.")).toBeVisible();
  await page.getByLabel("Seuil d'alerte de remplissage").fill("75");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Étape 5 : récapitulatif, puis création.
  await expect(page.getByText(`Vérifiez la configuration. À la création, la division devient active et l'invitation part à ${ADMIN_EMAIL}.`)).toBeVisible();
  await expect(page.getByRole("region", { name: "Étape 3 · Rôles et workflow" })).toContainText("Staff + Consulter le reporting");
  await expect(page.getByRole("region", { name: "Étape 4 · Règles de saisie" })).toContainText("Saisie en jours entiers, échéance vendredi à 18:00");
  expect(await axe(page)).toEqual([]);
  await page.getByRole("button", { name: "Créer la division et inviter l'administrateur" }).click();
  await expect(page).toHaveURL(/\/plateforme$/);
  await expect(page.getByRole("status").filter({ hasText: `Division Division créée e2e créée. L'invitation est partie à ${ADMIN_EMAIL}.` })).toBeVisible();
  const row = page.getByRole("row", { name: /Division créée e2e/ });
  await expect(row).toContainText("Active");
  await expect(row).toContainText("Nadia Nouvelle");

  await expect
    .poll(
      async () => {
        const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${ADMIN_EMAIL}"`)}`);
        const m = ((await r.json()) as { messages: Array<{ Subject: string; Created: string }> }).messages.find((x) => Date.parse(x.Created) >= since - 5_000);
        return m?.Subject;
      },
      { timeout: 15_000 },
    )
    .toBe("Votre accès à TimeSheet · Division créée e2e");

  // Gérer : suspension tout de suite, avec « Annuler ».
  await row.getByRole("link", { name: "Gérer la division Division créée e2e" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Division créée e2e" })).toBeVisible();
  await page.getByRole("button", { name: "Suspendre la division" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Division Division créée e2e suspendue" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Réactiver la division" })).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Modification annulée." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suspendre la division" })).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("réservé à l'admin plateforme", async ({ page }) => {
  await page.context().clearCookies();
  await signedIn(page, "paul.tchouta@exemple.com");
  await page.goto("/plateforme");
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
  expect((await page.request.get("/api/v1/plateforme/journal/export?format=csv")).status()).toBe(404);
  expect((await page.request.get("/api/v1/plateforme/divisions")).status()).toBe(404);
});
