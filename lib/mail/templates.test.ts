import { describe, expect, it } from "vitest";
import { wantsNotification } from "../notifications";
import { invitationMail, rejectedMail, reminderMail, resetMail, validatedMail } from "./templates";

const ref = { week: 12, range: "16–20 mars 2026", url: "http://localhost:3000/saisie/2026/12" };

describe("e-mails", () => {
  it("prévient le collaborateur d'une validation", () => {
    const m = validatedMail({ ...ref, to: "a@exemple.com", firstName: "Aïcha", validator: "Samuel Etoga", hours: "40 h" });
    expect(m.subject).toBe("Semaine 12 validée");
    expect(m.text).toContain("Bonjour Aïcha,");
    expect(m.text).toContain("Samuel Etoga a validé votre fiche de la semaine 12 (16–20 mars 2026) : 40 h.");
    expect(m.text).toContain(ref.url);
  });

  it("transmet le motif du rejet, échappé dans la version HTML", () => {
    const m = rejectedMail({ ...ref, to: "a@exemple.com", firstName: "Kevin", validator: "Samuel Etoga", reason: "Jeudi <5 h> & atelier annulé" });
    expect(m.subject).toBe("Semaine 12 rejetée : à corriger");
    expect(m.text).toContain("Motif : « Jeudi <5 h> & atelier annulé »");
    expect(m.html).toContain("Jeudi &lt;5 h&gt; &amp; atelier annulé");
    expect(m.html).not.toMatch(/<img|<script/);
  });

  it("relance le validateur", () => {
    const m = reminderMail({ ...ref, to: "s@exemple.com", firstName: "Samuel", name: "Laure Bikoï", since: "20 mars 2026" });
    expect(m.subject).toBe("Fiche de Laure Bikoï en attente depuis le 20 mars 2026");
  });

  it("invite à choisir un mot de passe, avec le lien", () => {
    const m = invitationMail({ to: "n@exemple.com", firstName: "Nadia", division: "CX Expertise", inviter: "Paul Tchouta", url: "http://localhost:3000/invitation/abc" });
    expect(m.subject).toBe("Votre accès à TimeSheet · CX Expertise");
    expect(m.text).toContain("Paul Tchouta vous a créé un compte TimeSheet dans la division CX Expertise.");
    expect(m.text).toContain("Choisir mon mot de passe : http://localhost:3000/invitation/abc");
    expect(m.html).not.toMatch(/<img|<script/);
  });

  it("envoie le lien de réinitialisation", () => {
    const m = resetMail({ to: "n@exemple.com", firstName: "Nadia", url: "http://localhost:3000/reinitialisation/abc" });
    expect(m.subject).toBe("Réinitialisation de votre mot de passe TimeSheet");
    expect(m.text).toContain("Choisir un nouveau mot de passe : http://localhost:3000/reinitialisation/abc");
  });

  it("respecte les préférences, actives par défaut", () => {
    expect(wantsNotification({}, "validated")).toBe(true);
    expect(wantsNotification(null, "rejected")).toBe(true);
    expect(wantsNotification({ rejected: false }, "rejected")).toBe(false);
  });
});
