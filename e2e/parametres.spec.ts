import { expect, test, type Page } from "@playwright/test";
import { axe, login, PASSWORD } from "./helpers";

// Jalon 6 : Paramètres (écran 14, PROMPT.md §9.11) et mot de passe oublié (§19).
// Lecture sur le compte d'Aïcha Ndongo ; écritures sur les comptes de la « Division
// d'administration de test », remis à zéro avant chaque exécution.
const AICHA = "aicha.ndongo@exemple.com";
const SACHA = "reglages.e2e@exemple.com";
const HUGO = "chef.e2e@exemple.com";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Paramètres : desktop (vues 375 px au jalon 8)");
test.describe.configure({ mode: "serial" });

async function openSettings(page: Page, email: string, password = PASSWORD) {
  await page.context().clearCookies();
  await login(page, email, password);
  await expect(page).not.toHaveURL(/\/connexion/);
  await page.goto("/parametres");
  await expect(page.getByRole("heading", { level: 1, name: "Paramètres" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("stagiaire : profil et stage en lecture seule, réglages de la planche 14", async ({ page }) => {
  await openSettings(page, AICHA);
  await expect(page.getByText("Votre compte, vos horaires et vos notifications.")).toBeVisible();
  const account = page.getByRole("region", { name: "Profil et stage" });
  await expect(account).toContainText("Aïcha Ndongo");
  await expect(account).toContainText("Superviseur");
  await expect(account).toContainText("Samuel Etoga");
  await expect(account).toContainText("Professionnel");
  await expect(account).toContainText("Du 05/01/2026 au 26/06/2026");
  await expect(page.getByRole("link", { name: "Signaler une erreur" })).toHaveAttribute("href", /^mailto:paul\.tchouta@exemple\.com\?subject=/);
  // Compte de démonstration : ses réglages peuvent avoir été changés à la main ; on vérifie
  // les champs et l'état écrit à côté de chaque interrupteur, pas leurs valeurs.
  await expect(page.getByLabel("Arrivée")).toHaveValue(/^\d{2}:\d{2}$/);
  for (const name of ["Rappel de saisie le vendredi à 12:00 si la semaine est incomplète", "E-mail quand une fiche est validée", "E-mail quand une fiche est rejetée", "Rappel quand une fiche de présence attend votre signature"]) {
    await expect(page.getByRole("switch", { name })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Notifications" })).toContainText(/Activé|Désactivé/);
  await expect(page.getByRole("switch", { name: "Reprendre les lignes de la semaine précédente à l'ouverture d'une semaine vide" })).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("horaires, notification avec « Annuler », préférences", async ({ page }) => {
  await openSettings(page, SACHA);
  // Compte sans stage : pas de bloc Horaires habituels ni de carte Stage.
  await expect(page.getByRole("heading", { name: "Horaires habituels" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Profil" })).toBeVisible();

  const validated = page.getByRole("switch", { name: "E-mail quand une fiche est validée" });
  await validated.uncheck();
  await expect(page.getByRole("status").filter({ hasText: "E-mail quand une fiche est validée : désactivé." })).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Modification annulée." })).toBeVisible();
  await expect(validated).toBeChecked();
  await page.getByRole("switch", { name: "E-mail quand une fiche est rejetée" }).uncheck();
  await expect(page.getByRole("status").filter({ hasText: "E-mail quand une fiche est rejetée : désactivé." })).toBeVisible();

  await page.getByRole("radio", { name: "Mot de passe" }).check();
  await page.getByRole("switch", { name: "Reprendre les lignes de la semaine précédente à l'ouverture d'une semaine vide" }).check();
  await page.getByRole("button", { name: "Enregistrer les préférences" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Préférences enregistrées." })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("switch", { name: "E-mail quand une fiche est rejetée" })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "E-mail quand une fiche est validée" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Mot de passe" })).toBeChecked();
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
  await expect(page.getByRole("status").filter({ hasText: "Mot de passe modifié." })).toBeVisible();
  await openSettings(page, SACHA, "Reglages-2026-neuf");
});

test("mot de passe oublié : même réponse pour tous, lien par e-mail", async ({ page }) => {
  test.setTimeout(90_000);
  const since = Date.now();
  await page.context().clearCookies();
  await page.goto("/mot-de-passe-oublie");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText("Saisissez une adresse e-mail valide.")).toBeVisible();
  await page.getByLabel("Adresse e-mail").fill("inconnu.e2e@exemple.com");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  const sent = "Si un compte actif correspond à cette adresse, un e-mail vient de partir. Pensez à vérifier vos courriers indésirables.";
  await expect(page.getByRole("status").filter({ hasText: sent })).toBeVisible();

  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Adresse e-mail").fill(HUGO);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status").filter({ hasText: sent })).toBeVisible();

  let id = "";
  await expect
    .poll(async () => {
      const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${HUGO}"`)}`);
      const m = ((await r.json()) as { messages: Array<{ ID: string; Subject: string; Created: string }> }).messages.find((x) => Date.parse(x.Created) >= since - 5_000);
      id = m?.ID ?? "";
      return m?.Subject;
    }, { timeout: 15_000 })
    .toBe("Réinitialisation de votre mot de passe TimeSheet");
  const text = ((await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string }).Text;
  const link = new URL(text.match(/https?:\/\/\S+\/reinitialisation\/\S+/)![0]).pathname;

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Nouveau mot de passe" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("Chef-equipe-2026");
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("Chef-equipe-2027");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Les deux mots de passe ne correspondent pas.")).toBeVisible();
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("Chef-equipe-2026");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page).toHaveURL(/\/connexion\?mot-de-passe=enregistre$/);
  await login(page, HUGO, "Chef-equipe-2026");
  await expect(page).not.toHaveURL(/\/connexion/);
});
