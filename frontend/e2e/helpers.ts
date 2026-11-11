import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.SEED_PASSWORD ?? "Demo-TimeSheet-2026";

/** Ouvre la connexion et attend que le formulaire soit interactif. */
export async function openLogin(page: Page) {
  await page.goto("/connexion");
  await expect(page.locator("form[aria-labelledby='titre-connexion']")).toBeVisible();
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await openLogin(page);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/** Connexion réussie : attend de quitter l'écran de connexion (session établie). */
export async function signedIn(page: Page, email: string, password = PASSWORD) {
  await login(page, email, password);
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Violations axe sérieuses ou critiques de la page. */
export async function axe(page: Page) {
  // Pointeur écarté : un lien survolé prend #f16e00 (3,0:1, compensé par le soulignement, §14).
  await page.mouse.move(0, 0);
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} : ${v.help}`);
}
