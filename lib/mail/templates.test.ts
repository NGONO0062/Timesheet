import { describe, expect, it } from "vitest";
import { wantsNotification } from "../notifications";
import { attendanceHrMail, invitationMail, rejectedMail, reminderMail, resetMail, tollgateDecisionMail, tollgateRequestMail, validatedMail } from "./templates";

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

  it("met chaque e-mail HTML en page comme une proforma : TimeSheet et l'émetteur, l'objet, la mention en pied, sans image", () => {
    const hr = attendanceHrMail({ to: "rh@exemple.com", name: "Inès Stage", month: "février 2026", supervisor: "Samuel Etoga", fileName: "f.pdf", pdf: new Uint8Array([1]) });
    for (const m of [validatedMail({ ...ref, to: "a@exemple.com", firstName: "Aïcha", validator: "Samuel Etoga", hours: "40 h" }), hr]) {
      expect(m.html).toMatch(/^<div style="max-width:640px;[^"]*"><table role="presentation"/);
      expect(m.html).toContain('<span style="color:#f16e00">Time</span>Sheet</span><div style="margin-top:10px"><b style="font-weight:700">Orange Cameroun</b></div>');
      expect(m.html).toContain(`font-weight:700">${m.subject}</div>`);
      expect(m.html).toMatch(/border-top:2px solid #000000;[^"]*">Interne Orange Cameroun · TimeSheet<\/p><\/div>$/);
      expect(m.html).not.toMatch(/<img/);
      expect(m.text.startsWith("Bonjour")).toBe(true);
    }
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

  const gate = { firstName: "Brigitte", project: "CX-2026-03 · Cartographie des irritants", phase: "Analyser", url: "http://localhost:3000/projets/p1/dmaic" };

  it("demande la revue de passage au sponsor, avec le message et le lien du suivi", () => {
    const m = tollgateRequestMail({ ...gate, to: "b@exemple.com", requester: "Samuel Etoga", done: 2, total: 3, note: "Causes <vérifiées>" });
    expect(m.subject).toBe("Revue de passage demandée · CX-2026-03 · Cartographie des irritants");
    expect(m.text).toContain("Samuel Etoga demande la revue de passage de la phase « Analyser » du projet CX-2026-03 · Cartographie des irritants, dont vous êtes sponsor. Livrables de la phase : 2 sur 3.");
    expect(m.text).toContain("Message : « Causes <vérifiées> »");
    expect(m.text).toContain("Ouvrir le suivi DMAIC : http://localhost:3000/projets/p1/dmaic");
    expect(m.html).toContain("Causes &lt;vérifiées&gt;");
  });

  it("annonce la décision du sponsor : passage accordé, démarche close ou compléments", () => {
    const base = { ...gate, to: "s@exemple.com", firstName: "Samuel", sponsor: "Brigitte Mbarga" };
    const ok = tollgateDecisionMail({ ...base, approved: true, next: "Améliorer", comment: null });
    expect(ok.subject).toBe("Passage accordé · CX-2026-03 · Cartographie des irritants");
    expect(ok.text).toContain("Le projet entre dans la phase « Améliorer ».");
    const closed = tollgateDecisionMail({ ...base, phase: "Contrôler", approved: true, next: null, comment: null });
    expect(closed.text).toContain("la démarche DMAIC est close");
    const changes = tollgateDecisionMail({ ...base, approved: false, next: null, comment: "Vérifier sur 3 mois" });
    expect(changes.subject).toBe("Compléments demandés · CX-2026-03 · Cartographie des irritants");
    expect(changes.text).toContain("Compléments attendus : « Vérifier sur 3 mois »");
  });
});
