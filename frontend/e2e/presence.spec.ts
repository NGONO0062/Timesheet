import { expect, test, type Page } from "@playwright/test";
import { axe, login, PASSWORD, sheetAxe, signedIn } from "./helpers";

// Jalon 5 de la réécriture : fiche de présence (écran 06) et signature du superviseur,
// repris de e2e/presence.spec.ts. Tout se passe dans la « Division de test » : Inès Stage
// (stagiaire, février 2026 validé) et Martin Valideur, son manager. L'e-mail aux RH
// arrive dans Mailpit.
const INES = "stagiaire.e2e@exemple.com";
const MARTIN = "valideur.e2e@exemple.com";
const HR = "rh.e2e@exemple.com";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.describe.configure({ mode: "serial" });
test.beforeEach(() => test.skip(test.info().project.name !== "desktop", "Fiche de présence : bureau (§19)"));

type MailSummary = { ID: string; Subject: string; Created: string };

async function mails(to: string, since: number): Promise<MailSummary[]> {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  if (!r.ok) return [];
  const body = (await r.json()) as { messages: MailSummary[] };
  return body.messages.filter((m) => Date.parse(m.Created) >= since - 5_000);
}

/** La feuille, dans le cadre de l'aperçu (même document que le PDF). */
const sheetOf = (page: Page) => page.frameLocator("iframe[title^='Fiche_presence_']").locator(".ts-sheet");

async function openSheet(page: Page) {
  await signedIn(page, INES);
  await page.goto("/fiche-presence");
  await expect(page).toHaveURL(/\/fiche-presence\/2026\/2$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ma fiche de présence" })).toBeVisible();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
}

async function openSupervisor(page: Page) {
  await page.context().clearCookies();
  await signedIn(page, MARTIN);
  await page.goto("/validation");
  await page.getByRole("link", { name: /^Fiches de présence à signer \(1\)$/ }).click();
  await expect(page).toHaveURL(/\/validation\/presence$/);
  await page.getByRole("link", { name: "Examiner la fiche de Inès Stage, Février 2026" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Inès Stage · Février 2026" })).toBeVisible();
}

async function draw(page: Page) {
  const pad = page.getByRole("img", { name: "Zone de tracé vide" }).locator("svg");
  const box = await pad.boundingBox();
  if (!box) throw new Error("Zone de tracé absente");
  await page.mouse.move(box.x + 40, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 40 + i * 40, box.y + box.height * (i % 2 ? 0.3 : 0.7), { steps: 3 });
  await page.mouse.up();
}

const trace = (page: Page) => page.locator("dl[aria-label='Traçabilité de la signature']").first();

let sheetPdf = "";

test("stagiaire : fiche générée, aperçu, PDF, signature par mot de passe", async ({ page }) => {
  test.setTimeout(90_000); // parcours long : connexion, aperçu, PDF par Chromium, signature, e-mail
  const since = Date.now();
  await openSheet(page);
  await expect(page.locator("main").getByText("À signer", { exact: true })).toBeVisible();
  const steps = page.getByRole("list", { name: "Circuit de la fiche de présence" });
  await expect(steps.locator('[aria-current="step"]')).toHaveText("2. Votre signature");
  await expect(page.getByText(/^Étape 2 sur 4\. Fiche générée le 9 mars 2026 à partir de vos quatre semaines validées\./)).toBeVisible();
  await expect(page.getByLabel("Période")).toHaveValue("/fiche-presence/2026/2");

  // Aperçu : le gabarit OCM/PS-01/SE/049, horaires habituels de la stagiaire.
  const sheet = sheetOf(page);
  await expect(sheet).toContainText("FICHE DE PRESENCE STAGIAIRE");
  await expect(sheet).toContainText("NOM ET PRENOM DU STAGIAIRE");
  await expect(sheet).toContainText("STAGE Inès");
  await expect(sheet.getByRole("img", { name: "coché", exact: true })).toHaveCount(1);
  await expect(sheet.getByRole("img", { name: "non coché", exact: true })).toHaveCount(2);
  await expect(sheet.getByRole("row", { name: "Lundi 02/02 08:30 17:30" })).toBeVisible();
  await expect(page.getByText("Les deux derniers blocs restent vides : février 2026 compte quatre semaines.")).toBeVisible();
  await expect(page.getByText("Arrivée et départ : vos horaires habituels (08:30 – 17:30), réglables dans")).toBeVisible();
  await expect(page.getByText("Fiche_presence_2026-02_STAGE.pdf · A4 paysage · page 1 sur 1")).toBeVisible();
  await page.getByRole("button", { name: "Augmenter le zoom" }).click();
  await expect(page.getByRole("status").filter({ hasText: "125 %" })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  expect(await sheetAxe(page)).toEqual([]);

  sheetPdf = (await page.getByRole("link", { name: "Télécharger le PDF" }).getAttribute("href")) ?? "";
  const pdf = await page.request.get(sheetPdf);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-disposition"]).toContain("filename=Fiche_presence_2026-02_STAGE.pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Signature : certification d'abord ; mot de passe vérifié de nouveau côté serveur.
  const sign = page.getByRole("button", { name: "Signer la fiche" });
  await expect(sign).toBeDisabled();
  await expect(page.getByText("Cochez la case de certification pour signer.")).toBeVisible();
  await page.getByLabel("Je certifie l'exactitude des informations de cette fiche de présence").check();
  await page.getByRole("button", { name: "Valider par mot de passe" }).click();
  await expect(trace(page)).toContainText("Validation par mot de passe");
  await page.getByLabel("Mot de passe").fill("pas-le-bon");
  await sign.click();
  await expect(page.getByText("Mot de passe incorrect.")).toBeVisible();
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await sign.click();
  await expect(page.getByRole("status").filter({ hasText: "Fiche signée. Martin Valideur, votre superviseur, est prévenu." })).toBeVisible();
  await expect(page.locator("main").getByText("En attente du superviseur", { exact: true })).toBeVisible();
  await expect(steps.locator('[aria-current="step"]')).toHaveText("3. Signature du superviseur");
  await expect(trace(page)).toContainText("Empreinte");

  await expect.poll(async () => (await mails(MARTIN, since)).map((m) => m.Subject), { timeout: 15_000 }).toContain("Fiche de présence de Inès Stage à signer (février 2026)");
});

test("superviseur : renvoi avec motif, la signature de la stagiaire est annulée", async ({ page }) => {
  test.setTimeout(90_000); // parcours long : superviseur, renvoi, puis stagiaire qui signe de nouveau
  await openSupervisor(page);
  await expect(page.getByText(/^Étape 3 sur 4\. Inès Stage a signé sa fiche le/)).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.getByRole("button", { name: "Renvoyer au stagiaire" }).click();
  const dialog = page.getByRole("dialog", { name: "Renvoyer la fiche à Inès Stage ?" });
  await dialog.getByRole("button", { name: "Renvoyer la fiche" }).click();
  await expect(dialog.getByText("Saisissez le motif du renvoi.")).toBeVisible();
  await expect(dialog.getByLabel("Motif du renvoi")).toBeFocused();
  await dialog.getByLabel("Motif du renvoi").fill("Le 13 février était un jour d'absence.");
  await dialog.getByRole("button", { name: "Renvoyer la fiche" }).click();
  // La fiche sort de la portée du détail superviseur : retour à la liste, avec la confirmation.
  await expect(page).toHaveURL(/\/validation\/presence$/);
  await expect(page.getByRole("status").filter({ hasText: "Fiche renvoyée à Inès Stage. Sa signature est annulée." })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Fiches de présence à signer \(0\)$/ })).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // Côté stagiaire : le motif, et la fiche de nouveau à signer, cette fois par tracé.
  await page.context().clearCookies();
  await openSheet(page);
  await expect(page.getByText(/Fiche renvoyée par Martin Valideur le .*Motif : « Le 13 février était un jour d'absence. »/)).toBeVisible();
  await page.getByLabel("Je certifie l'exactitude des informations de cette fiche de présence").check();
  await draw(page);
  await expect(page.getByRole("img", { name: "Signature tracée de Inès Stage" })).toBeVisible();
  await page.getByRole("button", { name: "Signer la fiche" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Fiche signée." })).toBeVisible();
});

test("superviseur : signature, PDF signé, e-mail aux RH avec la pièce jointe", async ({ page }) => {
  test.setTimeout(90_000); // parcours long : connexion, signature, PDF signé par Chromium, e-mail aux RH
  const since = Date.now();
  await openSupervisor(page);
  await page.getByLabel("Observation (imprimée sur la fiche)").fill("Stage suivi avec assiduité.");
  await page.getByRole("button", { name: "Valider par mot de passe" }).click();
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Signer la fiche" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Fiche signée. Fiche envoyée aux RH (${HR}).` })).toBeVisible();
  await expect(page.locator("main").getByText("Envoyée aux RH", { exact: true })).toBeVisible();
  await expect(sheetOf(page)).toContainText("Martin Valideur");
  await expect(sheetOf(page)).toContainText("Stage suivi avec assiduité.");

  // L'e-mail aux RH porte le PDF signé.
  let id = "";
  await expect
    .poll(
      async () => {
        const m = (await mails(HR, since)).find((x) => x.Subject === "Fiche de présence · Inès Stage · février 2026");
        id = m?.ID ?? "";
        return Boolean(id);
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  const detail = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Attachments: Array<{ FileName: string; ContentType: string; Size: number }> };
  expect(detail.Attachments).toEqual([expect.objectContaining({ FileName: "Fiche_presence_2026-02_STAGE.pdf", ContentType: "application/pdf" })]);
  expect(detail.Attachments[0]?.Size ?? 0).toBeGreaterThan(1000);

  // La stagiaire voit le circuit terminé.
  await page.context().clearCookies();
  await openSheet(page);
  await expect(page.locator("main").getByText("Envoyée aux RH", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Circuit terminé\. La fiche a été envoyée aux RH le/)).toBeVisible();
  const state = page.getByRole("region", { name: "Envoi aux RH" });
  await expect(state).toContainText(HR);
  await expect(state).toContainText(/Envoyée le/);
  expect(await axe(page)).toEqual([]);
});

test("accès : ni un autre collaborateur, ni un autre manager", async ({ page }) => {
  test.setTimeout(90_000); // parcours long : trois connexions
  expect(sheetPdf).not.toBe("");
  await signedIn(page, "aicha.ndongo@exemple.com");
  expect((await page.request.get(sheetPdf)).status()).toBe(404);

  await page.context().clearCookies();
  await signedIn(page, "samuel.etoga@exemple.com");
  const id = sheetPdf.split("/").at(-2) ?? "";
  await page.goto(`/validation/presence/${id}`);
  await expect(page.getByText("Cette fiche n'existe plus ou a déjà été traitée").first()).toBeVisible();
  expect((await page.request.get(sheetPdf)).status()).toBe(404);

  // Un collaborateur qui n'est pas stagiaire n'a pas l'écran.
  await page.context().clearCookies();
  await login(page, "alice.e2e@exemple.com");
  await page.waitForURL(/\/tableau-de-bord$/);
  await page.goto("/fiche-presence");
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
});
