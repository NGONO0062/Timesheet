import { expect, test, type Page } from "@playwright/test";
import { axe, login } from "./helpers";

// Jalon 9 de la réécriture : passe d'accessibilité (PROMPT.md §14 et §17), reprise de
// e2e/accessibilite.spec.ts. Chaque route, pour chaque rôle, au bureau (1280 px) et sur
// mobile (375 px) : zéro violation axe sérieuse ou critique, et pas de défilement horizontal
// de la page (les tableaux larges défilent dans leur zone). Lecture seule.
const TOURS: Array<[string | null, string[]]> = [
  [null, ["/connexion", "/mot-de-passe-oublie", "/invitation/lien-qui-n-existe-pas-0000", "/reinitialisation/lien-qui-n-existe-pas-0000"]],
  ["aicha.ndongo@exemple.com", ["/tableau-de-bord", "/saisie/2026/12", "/saisie/2026/11", "/taches", "/parametres"]],
  ["samuel.etoga@exemple.com", ["/tableau-de-bord", "/validation", "/validation?statut=VALIDATED", "/projets", "/projets?vue=colonnes", "/reporting", "/parametres"]],
  ["brigitte.mbarga@exemple.com", ["/division", "/validation", "/projets", "/reporting"]],
  ["paul.tchouta@exemple.com", ["/administration", "/parametres"]],
  ["rose.ekambi@exemple.com", ["/plateforme", "/plateforme/journal", "/plateforme/divisions/nouvelle", "/parametres"]],
];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

for (const [email, paths] of TOURS) {
  test(`${email ?? "pages publiques"} : axe et largeur, chaque route`, async ({ page }) => {
    test.setTimeout(60_000 + paths.length * 20_000);
    if (email) {
      await login(page, email);
      await expect(page).not.toHaveURL(/\/connexion/);
    }
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator("[aria-busy]")).toHaveCount(0);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      expect(await horizontalOverflow(page), `${path} : défilement horizontal`).toBeLessThanOrEqual(0);
      expect(await axe(page), `${path} : axe`).toEqual([]);
    }
  });
}
