import "server-only";
// Envoi SMTP (PROMPT.md §3) : Nodemailer, configuration par variables d'environnement.
// En développement, Mailpit (http://localhost:8025). Un échec d'envoi n'annule jamais
// l'action métier qui l'a déclenché : il est journalisé et signalé à l'appelant.
import nodemailer, { type Transporter } from "nodemailer";
import type { Mail } from "./templates";

let transport: Transporter | null = null;

function transporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  transport ??= nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    // Aucun contenu distant ni fichier local dans les messages.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return transport;
}

/** Adresse de l'application, pour les liens des e-mails. */
export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Envoie un e-mail ; renvoie false (sans lever) si l'envoi échoue ou si SMTP n'est pas configuré. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const t = transporter();
  if (!t) {
    console.warn(`E-mail non envoyé (SMTP_HOST vide) : ${mail.subject}`);
    return false;
  }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM ?? "TimeSheet <timesheet@exemple.com>", ...mail });
    return true;
  } catch (e) {
    console.error(`Échec d'envoi de l'e-mail « ${mail.subject} »`, e);
    return false;
  }
}
