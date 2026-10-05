// Gabarits d'e-mails (PROMPT.md §19) : texte brut et HTML sobre, sans image.
// Purs : l'envoi est fait par lib/mail/send.ts.
import { dict, t } from "../i18n";

export type Mail = { to: string; subject: string; text: string; html: string };

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Assemble un e-mail : salutation, paragraphes, lien, signature. */
function compose(to: string, subject: string, firstName: string, paragraphs: string[], url: string): Mail {
  const lines = [t(dict.mail.hello, { name: firstName }), ...paragraphs, t(dict.mail.open, { url }), dict.mail.signature];
  const text = lines.join("\n\n");
  const html = [
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.4;color:#000000">',
    ...[t(dict.mail.hello, { name: firstName }), ...paragraphs].map((p) => `<p>${escape(p)}</p>`),
    `<p><a href="${escape(url)}" style="color:#000000;text-decoration:underline">${escape(url)}</a></p>`,
    `<p style="color:#595959">${escape(dict.mail.signature)}</p>`,
    "</div>",
  ].join("");
  return { to, subject, text, html };
}

type SheetRef = { week: number; range: string; url: string };

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
