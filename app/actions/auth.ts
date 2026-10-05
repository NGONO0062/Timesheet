"use server";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { appendAudit } from "@/lib/data/audit";
import { loadViewer } from "@/lib/data/users";
import { DEMO_ACCOUNTS, demoProfilesEnabled } from "@/lib/demo";
import { homeFor } from "@/lib/navigation";

export type LoginState = {
  /** Erreur globale : identifiants incorrects ou trop de tentatives. */
  error?: "identifiants" | "tentatives";
  /** Erreurs par champ, si le contrôle du navigateur a été contourné. */
  fields?: { email?: "vide" | "format"; password?: "vide" };
  /** L'adresse e-mail reste saisie après un échec ; le mot de passe est vidé. */
  email?: string;
};

const form = z.object({ email: z.string().trim(), password: z.string() });

export async function login(_prev: LoginState, data: FormData): Promise<LoginState> {
  const { email, password } = form.parse({ email: data.get("email") ?? "", password: data.get("password") ?? "" });
  const fields: LoginState["fields"] = {};
  if (!email) fields.email = "vide";
  else if (!z.string().email().safeParse(email).success) fields.email = "format";
  if (!password) fields.password = "vide";
  if (fields.email || fields.password) return { fields, email };

  // Selon les versions d'Auth.js, un échec lève une AuthError ou renvoie une
  // adresse portant ?error=…&code=… : les deux cas sont traités.
  let failure: string | null = null;
  try {
    const result: unknown = await signIn("credentials", { email, password, redirect: false });
    if (typeof result === "string" && result.includes("error=")) failure = new URL(result, "http://local").searchParams.get("code") ?? "identifiants";
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    failure = (e as AuthError & { code?: string }).code ?? "identifiants";
  }
  if (failure) return { error: failure === "tentatives" ? "tentatives" : "identifiants", email };
  return redirectHome();
}

/** Prototype uniquement : entrer avec un profil de démonstration. */
export async function loginAsDemo(data: FormData): Promise<void> {
  const email = String(data.get("email") ?? "");
  if (!demoProfilesEnabled() || !DEMO_ACCOUNTS.some((a) => a.email === email)) return;
  await signIn("demo", { email, redirect: false });
  await redirectHome();
}

async function redirectHome(): Promise<never> {
  const session = await auth();
  const viewer = session?.user?.id ? await loadViewer(session.user.id) : null;
  redirect(viewer ? homeFor(viewer) : "/connexion");
}

export async function logout(): Promise<void> {
  const session = await auth();
  const viewer = session?.user?.id ? await loadViewer(session.user.id) : null;
  if (viewer) {
    await appendAudit({
      actorId: viewer.userId,
      actorLabel: `${viewer.firstName} ${viewer.lastName}`,
      divisionId: viewer.divisionId,
      action: "LOGOUT",
      objectLabel: viewer.email,
      result: "SUCCESS",
    });
  }
  await signOut({ redirectTo: "/connexion" });
}
