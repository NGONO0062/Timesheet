"use server";
// Actions de l'écran Projets (PROMPT.md §9.4). Entrées validées avec zod ; portée
// et règles revérifiées par la couche de données.
import { refresh } from "next/cache";
import { z } from "zod";
import { now } from "@/lib/clock";
import { changeProjectStatus, ProjectRuleError, saveProject, setProjectArchived } from "@/lib/data/projects";
import { getViewer, scopeOf } from "@/lib/data/viewer";
import type { ProjectFieldErrors } from "@/lib/projects/rules";
import type { ProjectStatus } from "@/lib/status";

const id = z.string().min(1).max(64);
const status = z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "DONE"]);
const project = z.object({
  name: z.string().max(200),
  start: z.string().max(20),
  end: z.string().max(20),
  status,
  budget: z.string().max(20),
  activities: z.array(z.string().max(200)).max(50),
  memberIds: z.array(id).max(500),
});

export type ProjectActionError = "session" | "notFound" | "members" | "unknown";

async function context() {
  const viewer = await getViewer();
  if (!viewer?.divisionId || !viewer.permissions.includes("MANAGE_PROJECTS")) return null;
  return { scope: scopeOf(viewer), label: `${viewer.firstName} ${viewer.lastName}` };
}

function failure(e: unknown): { ok: false; error: ProjectActionError } {
  if (e instanceof ProjectRuleError && (e.code === "notFound" || e.code === "members")) return { ok: false, error: e.code };
  console.error(e);
  return { ok: false, error: "unknown" };
}

/** Changement de statut immédiat ; renvoie l'ancien statut pour « Annuler ». */
export async function setProjectStatus(projectId: string, next: ProjectStatus) {
  const ctx = await context();
  if (!ctx || !id.safeParse(projectId).success || !status.safeParse(next).success) return { ok: false as const, error: "session" as const };
  try {
    const r = await changeProjectStatus(ctx.scope, projectId, next, now(), ctx.label);
    refresh();
    return { ok: true as const, name: r.name, previous: r.previous };
  } catch (e) {
    return failure(e);
  }
}

export type SaveProjectResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: ProjectActionError }
  | { ok: false; fields: ProjectFieldErrors & { activityInUse?: string } };

/** Création (`projectId` null) ou modification depuis le panneau. */
export async function saveProjectPanel(projectId: string | null, input: z.input<typeof project>): Promise<SaveProjectResult> {
  const ctx = await context();
  const parsed = project.safeParse(input);
  if (!ctx || !parsed.success || (projectId !== null && !id.safeParse(projectId).success)) return { ok: false, error: "session" };
  try {
    const r = await saveProject(ctx.scope, projectId, parsed.data, now(), ctx.label);
    refresh();
    return { ok: true, id: r.id, name: r.name };
  } catch (e) {
    if (e instanceof ProjectRuleError && e.code === "invalid") return { ok: false, fields: e.detail };
    if (e instanceof ProjectRuleError && e.code === "activityInUse") return { ok: false, fields: { activityInUse: e.detail.name } };
    return failure(e);
  }
}

/** Archivage (réversible) depuis le panneau de modification. */
export async function archiveProject(projectId: string, archived: boolean) {
  const ctx = await context();
  if (!ctx || !id.safeParse(projectId).success) return { ok: false as const, error: "session" as const };
  try {
    const r = await setProjectArchived(ctx.scope, projectId, archived, now(), ctx.label);
    refresh();
    return { ok: true as const, name: r.name };
  } catch (e) {
    return failure(e);
  }
}
