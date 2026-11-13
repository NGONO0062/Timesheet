import { expect, test, type Page } from "@playwright/test";
import { axe, PASSWORD, signedIn } from "./helpers";

// Jalon 6 de la réécriture : Paramètres (écran 14, PROMPT.md §9.11) et mot de passe oublié
// (§19), repris de e2e/parametres.spec.ts. Lecture sur le compte d'Aïcha Ndongo ; écritures
// sur les comptes de la « Division d'administration de test ».
const AICHA = "aicha.ndongo@exemple.com";
const SACHA = "reglages.e2e@exemple.com";
const HUGO = "chef.e2e@exemple.com";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.describe.configure({ mode: "serial" });
test.beforeEach(() => test.skip(test.info().project.name !== "desktop", "Paramètres : bureau (§19)"));

async function openSettings(page: Page, email: string, password = PASSWORD) {
  await page.context().clearCookies();
  await signedIn(page, email, password);
  await page.goto("/parametres");
  await expect(page.getByRole("heading", { level: 1, name: "Paramètres" })).toBeVisible();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
}

test("profil en lecture seule, notifications, langue ; plus de partie RH", async ({ page }) => {
  await openSettings(page, AICHA);
  await expect(page.getByText("Votre compte et vos notifications.")).toBeVisible();
  const account = page.getByRole("region", { name: "Profil" });
  await expect(account).toContainText("Aïcha Ndongo");
  await expect(account).toContainText("Manager");
  await expect(account).toContainText("Samuel Etoga");
  await expect(page.getByRole("link", { name: "Signaler une erreur" })).toHaveAttribute("href", /^mailto:paul\.tchouta@exemple\.com\?subject=/);
  for (const name of ["Rappel de saisie le vendredi à 12:00 si la semaine est incomplète", "E-mail quand une fiche est validée", "E-mail quand une fiche est rejetée"]) {
    await expect(page.getByRole("switch", { name })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Notifications" })).toContainText(/Activé|Désactivé/);
  await expect(page.getByLabel("Langue de l'interface")).toHaveValue("fr");
  // Partie RH retirée : ni stage, ni horaires habituels, ni signature.
  await expect(page.getByRole("heading", { name: "Horaires habituels" })).toHaveCount(0);
  await expect(page.getByText(/stage/i)).toHaveCount(0);
  await expect(page.getByRole("switch", { name: /signature/ })).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Fiche de présence" })).toHaveCount(0);
  // Saisie par jour (design v2, §1) : plus de reprise des lignes de la semaine précédente.
  await expect(page.getByRole("switch", { name: /Reprendre les lignes/ })).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
});

test("notification changée tout de suite, avec « Annuler »", async ({ page }) => {
  await openSettings(page, SACHA);
  await expect(page.getByRole("heading", { level: 2, name: "Profil" })).toBeVisible();

  const validated = page.getByRole("switch", { name: "E-mail quand une fiche est validée" });
  await validated.uncheck();
  await expect(page.getByRole("status").filter({ hasText: "E-mail quand une fiche est validée : désactivé." })).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Modification annulée." })).toBeVisible();
  await expect(validated).toBeChecked();
  await page.getByRole("switch", { name: "E-mail quand une fiche est rejetée" }).uncheck();
  await expect(page.getByRole("status").filter({ hasText: "E-mail quand une fiche est rejetée : désactivé." })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("switch", { name: "E-mail quand une fiche est rejetée" })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "E-mail quand une fiche est validée" })).toBeChecked();
  expect(await axe(page)).toEqual([]);
});

test("mot de passe : l'actuel est vérifié, le nouveau sert à la connexion suivante", async ({ page }) => {
  test.setTimeout(90_000);
  await openSettings(page, SACHA);
  await page.getByRole("button", { name: "Modifier le mot de passe" }).click();
  await expect(page.getByText("Saisissez votre mot de passe actuel.")).toBeVisible();
  await expect(page.getByLabel("Mot de passe actuel")).toBeFocused();
  await page.getByLabel("Mot de passe actuel").fill("pas-le-bon-mot-de-passe");
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("Reglages-2026-neuf");
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("Reglages-2026-neuf");
  await page.getByRole("button", { name: "Modifier le mot de passe" }).click();
  await expect(page.getByText("Mot de passe actuel incorrect.")).toBeVisible();
  await page.getByLabel("Mot de passe actuel").fill(PASSWORD);
  await page.getByRole("button", { name: "Modifier le mot de passe" }).click();
  // Toutes les sessions du compte sont fermées : retour à la connexion.
  await expect(page).toHaveURL(/\/connexion\?mot-de-passe=modifie$/);
  await expect(page.getByRole("status").filter({ hasText: "Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe." })).toBeVisible();
  await openSettings(page, SACHA, "Reglages-2026-neuf");
});

test("mot de passe oublié : même réponse pour tous, lien par e-mail", async ({ page }) => {
  test.setTimeout(90_000);
  const since = Date.now();
  await page.context().clearCookies();
  await page.goto("/mot-de-passe-oublie");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText("Saisissez une adresse e-mail valide.")).toBeVisible();
  await page.getByLabel("Adresse e-mail").fill("inconnu.e2e@exemple.com");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  const sent = "Si un compte actif correspond à cette adresse, un e-mail vient de partir. Pensez à vérifier vos courriers indésirables.";
  await expect(page.getByRole("status").filter({ hasText: sent })).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.reload();
  await page.getByLabel("Adresse e-mail").fill(HUGO);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status").filter({ hasText: sent })).toBeVisible();

  let id = "";
  await expect
    .poll(
      async () => {
        const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${HUGO}"`)}`);
        const m = ((await r.json()) as { messages: Array<{ ID: string; Subject: string; Created: string }> }).messages.find((x) => Date.parse(x.Created) >= since - 5_000);
        id = m?.ID ?? "";
        return m?.Subject;
      },
      { timeout: 15_000 },
    )
    .toBe("Réinitialisation de votre mot de passe TimeSheet");
  const text = ((await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string }).Text;
  const link = new URL(text.match(/https?:\/\/\S+\/reinitialisation\/\S+/)?.[0] ?? "http://x/").pathname;

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Nouveau mot de passe" })).toBeVisible();
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("Chef-equipe-2026");
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("Chef-equipe-2027");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Les deux mots de passe ne correspondent pas.")).toBeVisible();
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("Chef-equipe-2026");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page).toHaveURL(/\/connexion\?mot-de-passe=enregistre$/);
  await signedIn(page, HUGO, "Chef-equipe-2026");
});
