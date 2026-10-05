import { describe, expect, it } from "vitest";
import { wantsNotification } from "../notifications";
import { rejectedMail, reminderMail, validatedMail } from "./templates";

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

  it("respecte les préférences, actives par défaut", () => {
    expect(wantsNotification({}, "validated")).toBe(true);
    expect(wantsNotification(null, "rejected")).toBe(true);
    expect(wantsNotification({ rejected: false }, "rejected")).toBe(false);
  });
});
