import { expect, test, type Page } from "@playwright/test";
import { axe, login } from "./helpers";

// Jalon 6 : administration de division (écran 12, PROMPT.md §9.9 et §17, test 4).
// Lecture sur CX Expertise (Paul Tchouta) ; toutes les écritures dans la « Division
// d'administration de test » (prisma/e2e-fixtures.ts), remise à zéro avant chaque exécution.
const PAUL = "paul.tchouta@exemple.com";
const ADMIN = "admin.e2e@exemple.com";
const RULES = "regle.e2e@exemple.com";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Administration : desktop (§19, vues 375 px au jalon 8)");
test.describe.configure({ mode: "serial" });

async function openAdmin(page: Page, email: string, path = "/administration") {
  await page.context().clearCookies();
  await login(page, email);
  await expect(page).not.toHaveURL(/\/connexion/);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "Administration de la division" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

type MailSummary = { ID: string; Subject: string; Created: string };

async function lastMail(to: string, since: number): Promise<MailSummary | undefined> {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  if (!r.ok) return undefined;
  const body = (await r.json()) as { messages: MailSummary[] };
  return body.messages.find((m) => Date.parse(m.Created) >= since - 5_000);
}

async function linkIn(id: string): Promise<string> {
  const r = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  const body = (await r.json()) as { Text: string };
  return new URL(body.Text.match(/https?:\/\/\S+/)![0]).pathname;
}

test("CX Expertise : utilisateurs, recherche, pagination, permissions, accessibilité", async ({ page }) => {
  await openAdmin(page, PAUL);
  await expect(page.getByText("CX Expertise · ces réglages ne s'appliquent qu'à cette division.")).toBeVisible();
  const anchors = page.getByRole("navigation", { name: "Sur cette page :" });
  for (const name of ["Utilisateurs", "Rôles et permissions", "Workflows", "Règles de saisie"]) await expect(anchors.getByRole("link", { name })).toBeVisible();

  const users = page.getByRole("table", { name: "Utilisateurs de la division, avec leur rôle, leur manager et l'état de leur compte" });
  await expect(users.getByRole("row")).toHaveCount(6);
  await expect(page.getByText("Utilisateurs 1 à 5 sur 21")).toBeVisible();
  // Son propre compte : ni rôle ni compte modifiables.
  await expect(page.getByLabel("Rôle de Paul Tchouta")).toBeDisabled();
  await expect(page.getByRole("switch", { name: "Compte de Paul Tchouta" })).toBeDisabled();
  await page.getByRole("navigation", { name: "Pages des utilisateurs" }).getByRole("link", { name: "Page 5" }).click();
  await expect(page.getByText("Utilisateurs 21 à 21 sur 21")).toBeVisible();

  await page.getByLabel("Rechercher un utilisateur").fill("ndongo");
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page).toHaveURL(/\?recherche=ndongo/);
  await expect(page.getByText("Utilisateurs 1 à 1 sur 1")).toBeVisible();
  await expect(users.getByRole("rowheader")).toHaveText(/Aïcha Ndongo/);
  await expect(users.getByRole("row", { name: /Aïcha Ndongo/ })).toContainText("Samuel Etoga");

  await page.getByLabel("Rechercher un utilisateur").fill("personne-inconnue");
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByRole("heading", { name: "Aucun utilisateur ne correspond à cette recherche." })).toBeVisible();
  await page.getByRole("link", { name: "Voir tous les utilisateurs" }).click();
  await expect(page.getByText("Utilisateurs 1 à 5 sur 21")).toBeVisible();

  // Matrice du §7 : la permission de l'admin de division est verrouillée.
  const matrix = page.getByRole("table", { name: "Permissions accordées à chaque rôle de la division" });
  await expect(matrix.getByRole("checkbox", { name: "Saisir et soumettre ses temps : Staff" })).toBeChecked();
  await expect(matrix.getByRole("checkbox", { name: "Voir la vue consolidée de la division : Manager" })).not.toBeChecked();
  const locked = matrix.getByRole("checkbox", { name: "Gérer les utilisateurs, workflows et règles : Admin division" });
  await expect(locked).toBeChecked();
  await expect(locked).toBeDisabled();
  await expect(page.getByRole("switch", { name: "Validation par l'owner (N+2)" })).not.toBeChecked();
  await expect(page.getByText("Désactivée", { exact: true })).toBeVisible();
  await expect(page.getByText("Automatique", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Pas de saisie")).toHaveValue("0.5");
  expect(await axe(page)).toEqual([]);
});

test("les règles changées par l'admin s'appliquent à la saisie (§17, test 4)", async ({ page }) => {
  test.setTimeout(90_000); // parcours long : admin, puis collaboratrice
  await openAdmin(page, ADMIN, "/administration#regles");
  const hours = page.getByLabel("Heures attendues par jour");
  await hours.fill("7,3");
  await page.getByRole("button", { name: "Enregistrer les règles" }).click();
  await expect(page.getByText("Saisissez un nombre d'heures entre 0,25 et 24, par pas de 0,25.")).toBeVisible();
  await expect(hours).toBeFocused();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(hours).toHaveValue("8");

  await hours.fill("7");
  await page.getByLabel("Pas de saisie").selectOption("1");
  await page.getByRole("button", { name: "Enregistrer les règles" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Règles de saisie enregistrées. La saisie les applique dès maintenant." })).toBeVisible();

  // Permission accordée au rôle Staff de cette division : le Reporting apparaît.
  await page.getByRole("checkbox", { name: "Consulter le reporting : Staff" }).check();
  await page.getByRole("button", { name: "Enregistrer les permissions" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Permissions enregistrées." })).toBeVisible();

  await page.context().clearCookies();
  await login(page, RULES);
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  await expect(page.locator("main")).toContainText(/0\sh\s*saisies sur 35\sh/);
  await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Reporting" })).toBeVisible();
});

test("rôle et compte changés tout de suite, avec « Annuler »", async ({ page }) => {
  await openAdmin(page, ADMIN);
  const role = page.getByLabel("Rôle de Théo Cible");
  await role.selectOption("MANAGER");
  await expect(page.getByRole("status").filter({ hasText: "Rôle de Théo Cible : Manager." })).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Modification annulée." })).toBeVisible();
  await expect(role).toHaveValue("STAFF");

  const account = page.getByRole("switch", { name: "Compte de Théo Cible" });
  await account.uncheck();
  await expect(page.getByRole("status").filter({ hasText: "Compte de Théo Cible désactivé : la connexion est bloquée, les données restent." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Compte de Théo Cible" })).not.toBeChecked();
  await expect(page.getByLabel("Rôle de Théo Cible")).toBeDisabled();
  // Compte désactivé : la connexion est refusée.
  await page.context().clearCookies();
  await login(page, "cible.e2e@exemple.com");
  await expect(page.getByText(/^L.adresse e-mail ou le mot de passe est incorrect./)).toBeVisible();
});

test("invitation : e-mail, choix du mot de passe, première connexion", async ({ page }) => {
  test.setTimeout(90_000);
  const since = Date.now();
  const email = "nina.invitee.e2e@exemple.com";
  await openAdmin(page, ADMIN);
  await page.getByRole("button", { name: "Inviter un utilisateur" }).click();
  const dialog = page.getByRole("dialog", { name: "Inviter un utilisateur" });
  await dialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(dialog.getByText("Saisissez le prénom.")).toBeVisible();
  await expect(dialog.getByLabel("Prénom")).toBeFocused();
  await dialog.getByLabel("Prénom").fill("Nina");
  await dialog.getByLabel("Nom", { exact: true }).fill("Invitée");
  await dialog.getByLabel("Adresse e-mail").fill(email);
  await dialog.getByLabel("Manager").selectOption({ label: "Hugo Chef" });
  expect(await axe(page)).toEqual([]);
  await dialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Invitation envoyée à ${email}.` })).toBeVisible();
  await page.getByLabel("Rechercher un utilisateur").fill("Invitée");
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByRole("row", { name: /Nina Invitée/ })).toContainText("Invitation envoyée");
  await expect(page.getByRole("row", { name: /Nina Invitée/ })).toContainText("Hugo Chef");

  await expect.poll(async () => (await lastMail(email, since))?.Subject, { timeout: 15_000 }).toBe("Votre accès à TimeSheet · Division d'administration de test");
  const link = await linkIn((await lastMail(email, since))!.ID);
  expect(link).toMatch(/^\/invitation\/[\w-]+$/);

  await page.context().clearCookies();
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Choisir votre mot de passe" })).toBeVisible();
  await expect(page.getByText(`Bienvenue Nina. Choisissez le mot de passe de votre compte ${email}.`)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("court1");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Le mot de passe doit compter 12 caractères au moins, dont une lettre et un chiffre.")).toBeVisible();
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("Invitation-2026-ok");
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("Invitation-2026-ok");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page).toHaveURL(/\/connexion\?mot-de-passe=enregistre$/);
  await expect(page.getByRole("status").filter({ hasText: "Mot de passe enregistré. Vous pouvez vous connecter." })).toBeVisible();
  await login(page, email, "Invitation-2026-ok");
  await expect(page).toHaveURL(/\/tableau-de-bord$/);

  // Le lien a servi : il n'est plus valable.
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page.getByRole("alert").filter({ hasText: "Ce lien n'est plus valable" })).toBeVisible();
});
