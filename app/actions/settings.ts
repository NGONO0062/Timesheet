"use server";
// Actions de l'écran Paramètres (PROMPT.md §9.11, écran 14). Chaque action ne touche que
// le compte de l'utilisateur connecté ; entrées validées avec zod.
import { refresh } from "next/cache";
import { z } from "zod";
import { changePassword, savePreferences, saveUsualHours, setNotification, SettingsRuleError } from "@/lib/data/settings";
import { getViewer } from "@/lib/data/viewer";

const kind = z.enum(["fillReminder", "validated", "rejected", "signatureReminder"]);
const preferences = z.object({ locale: z.enum(["fr", "en"]), defaultSignatureMode: z.enum(["DRAWN", "PASSWORD"]), copyPreviousWeek: z.boolean() });

export type SettingsError = SettingsRuleError["code"] | "session" | "unknown";
type Fail = { ok: false; error: SettingsError };

async function self() {
  const viewer = await getViewer();
  return viewer ? { userId: viewer.userId } : null;
}

function failure(e: unknown): Fail {
  if (e instanceof SettingsRuleError) return { ok: false, error: e.code };
  console.error(e);
  return { ok: false, error: "unknown" };
}

const session: Fail = { ok: false, error: "session" };

export async function saveHours(arrival: string, departure: string): Promise<{ ok: true } | Fail> {
  const scope = await self();
  if (!scope || typeof arrival !== "string" || typeof departure !== "string" || arrival.length > 10 || departure.length > 10) return session;
  try {
    await saveUsualHours(scope, arrival, departure);
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** Interrupteur de notification, enregistré tout de suite ; renvoie l'ancienne valeur pour « Annuler ». */
export async function toggleNotification(k: z.input<typeof kind>, enabled: boolean): Promise<{ ok: true; previous: boolean } | Fail> {
  const scope = await self();
  if (!scope || !kind.safeParse(k).success || typeof enabled !== "boolean") return session;
  try {
    const previous = await setNotification(scope, k, enabled);
    return { ok: true, previous };
  } catch (e) {
    return failure(e);
  }
}

export async function savePreferencesForm(input: z.input<typeof preferences>): Promise<{ ok: true } | Fail> {
  const scope = await self();
  const parsed = preferences.safeParse(input);
  if (!scope || !parsed.success) return session;
  try {
    await savePreferences(scope, parsed.data);
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function changePasswordForm(current: string, next: string, confirm: string): Promise<{ ok: true } | Fail> {
  const scope = await self();
  if (!scope || [current, next, confirm].some((v) => typeof v !== "string" || v.length > 200)) return session;
  try {
    await changePassword(scope, current, next, confirm);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
