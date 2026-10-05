import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Jalon 1 : connexion, navigation par rôle, déconnexion. Données du seed.
const PASSWORD = process.env.SEED_PASSWORD ?? "Demo-TimeSheet-2026";

/** Ouvre la connexion et attend que le formulaire soit interactif (React hydraté). */
async function openLogin(page: Page) {
  await page.goto("/connexion");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("form[aria-labelledby='titre-connexion']")).toBeVisible();
}

async function login(page: Page, email: string, password = PASSWORD) {
  await openLogin(page);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function axe(page: Page) {
  // Pointeur écarté : un lien survolé prend #f16e00 (3,0:1, compensé par le soulignement, §14).
  await page.mouse.move(0, 0);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} : ${v.help}`);
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Navigation principale" });

test.describe("écran de connexion", () => {
  test("champs vides : message sous chaque champ, focus sur le premier", async ({ page }) => {
    await openLogin(page);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Saisissez votre adresse e-mail.")).toBeVisible();
    await expect(page.getByText("Saisissez votre mot de passe.")).toBeVisible();
    await expect(page.getByLabel("Adresse e-mail")).toBeFocused();
    await expect(page.getByLabel("Adresse e-mail")).toHaveAttribute("aria-invalid", "true");
    expect(await axe(page)).toEqual([]);
  });

  // Les mots de passe faux visent des adresses dédiées : 5 échecs bloquent une adresse
  // 15 minutes, et les comptes du seed doivent rester utilisables par les autres tests.
  test("identifiants incorrects : alerte neutre, adresse conservée, mot de passe vidé", async ({ page }) => {
    const email = `erreur-${Date.now()}-${test.info().project.name}@exemple.com`;
    await login(page, email, "mauvais-mot-de-passe");
    const alert = page.locator(".alert[role='alert']");
    await expect(alert).toContainText("Connexion impossible");
    await expect(alert).toContainText("L'adresse e-mail ou le mot de passe est incorrect.");
    await expect(page.getByLabel("Adresse e-mail")).toHaveValue(email);
    await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveValue("");
    expect(await axe(page)).toEqual([]);
  });

  test("compte inconnu et compte désactivé : même message", async ({ page }) => {
    await login(page, `inconnu-${Date.now()}@exemple.com`);
    await expect(page.locator(".alert[role='alert']")).toContainText("L'adresse e-mail ou le mot de passe est incorrect.");
    // Compte désactivé : refusé avec la même alerte (ou le blocage, après plusieurs exécutions).
    await login(page, "marie-claire.abega@exemple.com");
    await expect(page.locator(".alert[role='alert']")).toContainText("Connexion impossible");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("limitation des tentatives après 5 échecs", async ({ page }) => {
    const email = `tentatives-${Date.now()}-${test.info().project.name}@exemple.com`;
    for (let i = 0; i < 5; i++) {
      await login(page, email, "faux");
      await expect(page.locator(".alert[role='alert']")).toContainText("incorrect");
    }
    await login(page, email, "faux");
    await expect(page.locator(".alert[role='alert']")).toContainText("Trop de tentatives");
  });

  test("« Afficher / Masquer » le mot de passe", async ({ page }) => {
    await openLogin(page);
    const field = page.getByLabel("Mot de passe", { exact: true });
    const toggle = page.getByRole("button", { name: "Afficher" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(field).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Masquer" })).toHaveAttribute("aria-pressed", "true");
  });

  test("pages protégées : retour à la connexion sans session", async ({ page }) => {
    await page.goto("/tableau-de-bord");
    await expect(page).toHaveURL(/\/connexion$/);
  });
});

test.describe("navigation par rôle", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Barre latérale : desktop");

  test("staff stagiaire : trois liens, lien courant marqué", async ({ page }) => {
    await login(page, "aicha.ndongo@exemple.com");
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(nav(page).getByRole("link")).toHaveText(["Tableau de bord", "Saisie hebdomadaire", "Fiche de présence"]);
    await expect(nav(page).getByRole("link", { name: "Tableau de bord" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Aïcha Ndongo")).toBeVisible();
    expect(await axe(page)).toEqual([]);
    // Sans la permission, la page n'existe pas.
    const r = await page.goto("/projets");
    expect(r?.status()).toBe(404);
  });

  test("manager qui saisit ses temps : liens Staff et liens Manager", async ({ page }) => {
    await login(page, "samuel.etoga@exemple.com");
    await expect(nav(page).getByRole("link")).toHaveText(["Tableau de bord", "Saisie hebdomadaire", "Validation", "Projets", "Reporting"]);
  });

  test("owner : vue division d'abord", async ({ page }) => {
    await login(page, "brigitte.mbarga@exemple.com");
    await expect(page).toHaveURL(/\/division$/);
    await expect(nav(page).getByRole("link")).toHaveText(["Vue division", "Validation", "Projets", "Reporting"]);
  });

  test("admin plateforme : toutes les divisions", async ({ page }) => {
    await login(page, "rose.ekambi@exemple.com");
    await expect(page).toHaveURL(/\/plateforme$/);
    await expect(nav(page).getByRole("link")).toHaveText(["Divisions", "Journal d'audit"]);
    await expect(page.locator(".sidenav").getByText("Toutes les divisions")).toBeVisible();
  });

  test("déconnexion : retour à la connexion, session fermée", async ({ page }) => {
    await login(page, "paul.tchouta@exemple.com");
    await expect(page).toHaveURL(/\/administration$/);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await page.goto("/administration");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("profil de démonstration (DEMO_PROFILES)", async ({ page }) => {
    await page.goto("/connexion");
    const block = page.locator(".ts-todo");
    test.skip((await block.count()) === 0, "DEMO_PROFILES n'est pas activé");
    await block.getByRole("button", { name: "Manager" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.getByText("Samuel Etoga")).toBeVisible();
  });
});

test.describe("mobile 375", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, "Barre haute : mobile");

  test("menu dans un Offcanvas : Échap ferme et rend le focus", async ({ page }) => {
    await login(page, "aicha.ndongo@exemple.com");
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(page.locator("aside.sidenav")).toBeHidden();
    const open = page.getByRole("button", { name: "Ouvrir le menu" });
    await open.click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "Saisie hebdomadaire" })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(open).toBeFocused();
  });

  test("connexion : bandeau en tête sans les trois étapes", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByText("Le suivi du temps de votre division, semaine après semaine.")).toBeVisible();
    await expect(page.locator(".ts-login-steps")).toBeHidden();
    expect(await axe(page)).toEqual([]);
  });
});
