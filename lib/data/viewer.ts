import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Permission } from "@/lib/permissions";
import type { Viewer } from "@/lib/viewer";
import type { DivisionScope } from "./db";
import { loadViewer } from "./users";

/** Utilisateur connecté, relu en base une fois par requête. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  return userId ? loadViewer(userId) : null;
});

/** Page protégée : sans session valide, retour à la connexion. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  return viewer;
}

/** Page réservée à une permission : sans elle, la page n'existe pas pour l'utilisateur. */
export async function requirePermission(permission: Permission): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.permissions.includes(permission)) notFound();
  return viewer;
}

export async function requirePlatformAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role !== "PLATFORM_ADMIN") notFound();
  return viewer;
}

/** Contexte d'accès aux données de la division de l'utilisateur. */
export function scopeOf(viewer: Viewer): DivisionScope {
  if (!viewer.divisionId) notFound();
  return { divisionId: viewer.divisionId, userId: viewer.userId, role: viewer.role, permissions: new Set(viewer.permissions) };
}
