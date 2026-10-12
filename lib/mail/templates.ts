// Gabarits d'e-mails (PROMPT.md §19) : texte brut et HTML sobre, sans image.
// Le HTML est mis en page comme une proforma : émetteur et objet en tête, mention en pied. Purs : l'envoi est fait par lib/mail/send.ts.
import { documentHeadHtml } from "../export/brand";
import { dict, t } from "../i18n";

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Contenu en mémoire seulement (l'envoi refuse les fichiers locaux et les adresses). */
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
};

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** En-tête : le mot TimeSheet et l'émetteur à gauche, l'objet à droite. */
const open = (subject: string) =>
  `<div style="max-width:640px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.4;color:#000000">${documentHeadHtml({ issuer: [dict.document.issuer], title: subject, facts: [], size: 14, upper: false })}<div style="padding:20px 0">`;

/** Pied : la mention interne, sous un filet noir. */
const CLOSE = `</div><p style="margin:0;padding-top:10px;border-top:2px solid #000000;font-size:14px;color:#595959">${escape(dict.document.footer)}</p></div>`;

/** Assemble un e-mail : salutation, paragraphes, lien, signature. */
function compose(to: string, subject: string, firstName: string, paragraphs: string[], url: string, link: string = dict.mail.open): Mail {
  const lines = [t(dict.mail.hello, { name: firstName }), ...paragraphs, t(link, { url }), dict.mail.signature];
  const text = lines.join("\n\n");
  const html = [
    open(subject),
    ...[t(dict.mail.hello, { name: firstName }), ...paragraphs].map((p) => `<p>${escape(p)}</p>`),
    `<p><a href="${escape(url)}" style="color:#000000;text-decoration:underline">${escape(url)}</a></p>`,
    CLOSE,
  ].join("");
  return { to, subject, text, html };
}

type SheetRef = { week: number; range: string; url: string };

/** Invitation (PROMPT.md §19) : premier mot de passe, lien valable 7 jours. */
export function invitationMail(input: { to: string; firstName: string; division: string; inviter: string; url: string }): Mail {
  return compose(
    input.to,
    t(dict.mail.invitationSubject, { division: input.division }),
    input.firstName,
    [t(dict.mail.invitationBody, { inviter: input.inviter, division: input.division })],
    input.url,
    dict.mail.invitationLink,
  );
}

/** Mot de passe oublié : lien valable une heure. */
export function resetMail(input: { to: string; firstName: string; url: string }): Mail {
  return compose(input.to, dict.mail.resetSubject, input.firstName, [dict.mail.resetBody], input.url, dict.mail.resetLink);
}

export function validatedMail(input: SheetRef & { to: string; firstName: string; validator: string; hours: string }): Mail {
  return compose(
    input.to,
    t(dict.mail.validatedSubject, { week: input.week }),
    input.firstName,
    [t(dict.mail.validatedBody, { validator: input.validator, week: input.week, range: input.range, hours: input.hours })],
    input.url,
  );
}

export function rejectedMail(input: SheetRef & { to: string; firstName: string; validator: string; reason: string }): Mail {
  return compose(
    input.to,
    t(dict.mail.rejectedSubject, { week: input.week }),
    input.firstName,
    [t(dict.mail.rejectedBody, { validator: input.validator, week: input.week, range: input.range }), t(dict.mail.rejectedReason, { reason: input.reason })],
    input.url,
  );
}

export function reminderMail(input: SheetRef & { to: string; firstName: string; name: string; since: string }): Mail {
  return compose(
    input.to,
    t(dict.mail.reminderSubject, { name: input.name, date: input.since }),
    input.firstName,
    [t(dict.mail.reminderBody, { name: input.name, week: input.week, range: input.range, date: input.since })],
    input.url,
  );
}

/** Relance d'un manager depuis la vue consolidée : fiches de son équipe en attente. */
export function managerReminderMail(input: { to: string; firstName: string; team: string; count: number; days: number; url: string }): Mail {
  return compose(
    input.to,
    t(dict.mail.managerReminderSubject, { team: input.team }),
    input.firstName,
    [t(input.count > 1 ? dict.mail.managerReminderBodyMany : dict.mail.managerReminderBodyOne, { n: input.count, team: input.team, days: input.days })],
    input.url,
  );
}

/** Rappel de saisie : la semaine n'est pas soumise à l'échéance. */
export function fillReminderMail(input: SheetRef & { to: string; firstName: string; deadline: string }): Mail {
  return compose(
    input.to,
    t(dict.mail.fillReminderSubject, { week: input.week }),
    input.firstName,
    [t(dict.mail.fillReminderBody, { week: input.week, range: input.range, deadline: input.deadline })],
    input.url,
  );
}

/** Rappel du vendredi à 12:00 (écran 14) : semaine incomplète, avant l'échéance. */
export function fillUpcomingMail(input: SheetRef & { to: string; firstName: string; done: string; expected: string; deadline: string }): Mail {
  return compose(
    input.to,
    t(dict.mail.fillUpcomingSubject, { week: input.week, deadline: input.deadline }),
    input.firstName,
    [t(dict.mail.fillUpcomingBody, { week: input.week, range: input.range, done: input.done, expected: input.expected, deadline: input.deadline })],
    input.url,
  );
}

/** Fiche de présence générée : le stagiaire est invité à la signer. */
export function attendanceToSignMail(input: { to: string; firstName: string; month: string; url: string }): Mail {
  return compose(input.to, t(dict.mail.attendanceToSignSubject, { month: input.month }), input.firstName, [t(dict.mail.attendanceToSignBody, { month: input.month })], input.url);
}

/** Signature du stagiaire posée : le superviseur est invité à signer à son tour. */
export function attendanceSupervisorMail(input: { to: string; firstName: string; name: string; month: string; url: string }): Mail {
  return compose(
    input.to,
    t(dict.mail.attendanceSupervisorSubject, { name: input.name, month: input.month }),
    input.firstName,
    [t(dict.mail.attendanceSupervisorBody, { name: input.name, month: input.month })],
    input.url,
  );
}

/** Fiche renvoyée au stagiaire par le superviseur, avec le motif. */
export function attendanceRejectedMail(input: { to: string; firstName: string; supervisor: string; month: string; reason: string; url: string }): Mail {
  return compose(
    input.to,
    t(dict.mail.attendanceRejectedSubject, { month: input.month }),
    input.firstName,
    [t(dict.mail.attendanceRejectedBody, { supervisor: input.supervisor, month: input.month }), t(dict.mail.rejectedReason, { reason: input.reason })],
    input.url,
  );
}

/** Envoi aux RH : la fiche signée en pièce jointe, sans lien vers l'application. */
export function attendanceHrMail(input: { to: string; name: string; month: string; supervisor: string; fileName: string; pdf: Uint8Array }): Mail {
  const paragraphs = [
    dict.mail.hrHello,
    t(dict.mail.attendanceHrBody, { name: input.name, month: input.month, supervisor: input.supervisor }),
    t(dict.mail.attendanceHrAttachment, { file: input.fileName }),
  ];
  return {
    to: input.to,
    subject: t(dict.mail.attendanceHrSubject, { name: input.name, month: input.month }),
    text: [...paragraphs, dict.mail.signature].join("\n\n"),
    html: [
      open(t(dict.mail.attendanceHrSubject, { name: input.name, month: input.month })),
      ...paragraphs.map((p) => `<p>${escape(p)}</p>`),
      CLOSE,
    ].join(""),
    attachments: [{ filename: input.fileName, content: Buffer.from(input.pdf), contentType: "application/pdf" }],
  };
}
