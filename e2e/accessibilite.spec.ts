import { expect, test, type Page } from "@playwright/test";
import { axe, login } from "./helpers";

// Jalon 8 : passe d'accessibilité (PROMPT.md §14 et §17). Chaque route, pour chaque rôle,
// en desktop (1280 px) et en mobile (375 px) : zéro violation axe sérieuse ou critique,
// et pas de défilement horizontal de la page (les tableaux larges défilent dans leur zone).
// Lecture seule : aucune donnée n'est modifiée.
const TOURS: Array<[string | null, string[]]> = [
  [null, ["/connexion", "/mot-de-passe-oublie", "/invitation/lien-qui-n-existe-pas-0000", "/reinitialisation/lien-qui-n-existe-pas-0000"]],
  ["aicha.ndongo@exemple.com", ["/tableau-de-bord", "/saisie/2026/12", "/saisie/2026/11", "/fiche-presence", "/parametres"]],
  ["samuel.etoga@exemple.com", ["/tableau-de-bord", "/validation", "/validation?statut=VALIDATED", "/validation/presence", "/projets", "/projets?vue=colonnes", "/reporting", "/parametres"]],
  ["brigitte.mbarga@exemple.com", ["/division", "/validation", "/projets", "/reporting"]],
  ["paul.tchouta@exemple.com", ["/administration", "/parametres"]],
  ["rose.ekambi@exemple.com", ["/plateforme", "/plateforme/journal", "/plateforme/divisions/nouvelle", "/parametres"]],
];

async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

for (const [email, paths] of TOURS) {
  test(`${email ?? "pages publiques"} : axe et largeur, chaque route`, async ({ page }) => {
    test.setTimeout(60_000 + paths.length * 45_000); // une compilation à la demande par route
    if (email) {
      await login(page, email);
      await expect(page).not.toHaveURL(/\/connexion/);
    }
    for (const path of paths) {
      await page.goto(path, { timeout: 60_000 });
      // Le serveur de développement peut garder une connexion ouverte : on n'attend pas indéfiniment.
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await expect(page.locator("main[aria-busy]")).toHaveCount(0);
      expect(await noHorizontalScroll(page), `${path} : défilement horizontal`).toBeLessThanOrEqual(0);
      expect(await axe(page), `${path} : axe`).toEqual([]);
    }
  });
}
