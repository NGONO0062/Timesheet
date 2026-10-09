"use server";
// Liens à usage unique (PROMPT.md §19) : première connexion par invitation et mot de
// passe oublié. Pages publiques : la réponse ne dit jamais si une adresse est connue.
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkNewPassword, isEmail } from "@/lib/admin/rules";
import { now } from "@/lib/clock";
import { consumeToken, requestReset, type TokenKind } from "@/lib/data/tokens";
import { resetMail } from "@/lib/mail/templates";
import { appUrl, sendMail } from "@/lib/mail/send";

export type ResetRequestResult = { ok: true } | { ok: false; error: "email" };

/** Demande de réinitialisation : même réponse que le compte existe ou non. */
export async function requestPasswordReset(email: string): Promise<ResetRequestResult> {
  if (typeof email !== "string" || email.length > 254 || !isEmail(email)) return { ok: false, error: "email" };
  const link = await requestReset(email, now());
  if (link) await sendMail(resetMail({ to: link.email, firstName: link.firstName, url: appUrl(`/reinitialisation/${link.token}`) }));
  return { ok: true };
}

const kind = z.enum(["INVITATION", "RESET"]);

export type SetPasswordResult = { ok: false; field: "next" | "confirm"; message: string } | { ok: false; expired: true };

/** Choix du mot de passe depuis le lien ; en cas de succès, retour à la connexion. */
export async function setPasswordFromLink(k: TokenKind, token: string, next: string, confirm: string): Promise<SetPasswordResult> {
  if (!kind.safeParse(k).success || [token, next, confirm].some((v) => typeof v !== "string" || v.length > 200)) return { ok: false, expired: true };
  const problem = checkNewPassword(next, confirm);
  if (problem) return { ok: false, ...problem };
  if (!(await consumeToken(token, k, next, now()))) return { ok: false, expired: true };
  redirect("/connexion?mot-de-passe=enregistre");
}
