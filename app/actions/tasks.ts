"use server";
// Actions du tableau Kanban (PROMPT.md §9.12). Entrées validées avec zod ; portée et
// règles revérifiées par la couche de données.
import { refresh } from "next/cache";
import { z } from "zod";
import { now } from "@/lib/clock";
import { AccessDenied } from "@/lib/data/db";
import { createTask, moveTask, renameTask, setTaskDeleted, TaskRuleError } from "@/lib/data/tasks";
import { getViewer, scopeOf } from "@/lib/data/viewer";
import { TASK_STATUS_ORDER, type TaskStatus } from "@/lib/status";

const id = z.string().min(1).max(64);
const title = z.string().max(1000);
const status = z.enum(TASK_STATUS_ORDER as [TaskStatus, ...TaskStatus[]]);
const position = z.number().int().min(0).max(1_000_000);

export type TaskActionError = "session" | "notFound" | "readOnly" | "unknown";
type Failure = { ok: false; error: TaskActionError } | { ok: false; field: string };

async function scope() {
  const viewer = await getViewer();
  if (!viewer?.divisionId) return null;
  if (!viewer.permissions.includes("ENTER_TIME") && !viewer.permissions.includes("MANAGE_PROJECTS")) return null;
  return scopeOf(viewer);
}

function failure(e: unknown): Failure {
  if (e instanceof TaskRuleError) return e.code === "invalid" ? { ok: false, field: e.detail } : { ok: false, error: e.code };
  if (e instanceof AccessDenied) return { ok: false, error: "session" };
  console.error(e);
  return { ok: false, error: "unknown" };
}

export async function addTask(projectId: string, raw: string): Promise<{ ok: true; id: string; title: string } | Failure> {
  const s = await scope();
  if (!s || !id.safeParse(projectId).success || !title.safeParse(raw).success) return { ok: false, error: "session" };
  try {
    const r = await createTask(s, projectId, raw, now());
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    return failure(e);
  }
}

/** Déplacement immédiat ; renvoie la place d'origine pour « Annuler ». */
export async function moveTaskTo(taskId: string, next: TaskStatus, at?: number) {
  const s = await scope();
  if (!s || !id.safeParse(taskId).success || !status.safeParse(next).success || (at !== undefined && !position.safeParse(at).success)) {
    return { ok: false as const, error: "session" as const };
  }
  try {
    const r = await moveTask(s, taskId, next, at);
    refresh();
    return { ok: true as const, ...r };
  } catch (e) {
    return failure(e);
  }
}

export async function renameTaskTo(taskId: string, raw: string) {
  const s = await scope();
  if (!s || !id.safeParse(taskId).success || !title.safeParse(raw).success) return { ok: false as const, error: "session" as const };
  try {
    const r = await renameTask(s, taskId, raw);
    refresh();
    return { ok: true as const, ...r };
  } catch (e) {
    return failure(e);
  }
}

/** Suppression (réversible) ou retour d'une tâche supprimée (« Annuler »). */
export async function deleteTask(taskId: string, deleted: boolean) {
  const s = await scope();
  if (!s || !id.safeParse(taskId).success) return { ok: false as const, error: "session" as const };
  try {
    const r = await setTaskDeleted(s, taskId, deleted, now());
    refresh();
    return { ok: true as const, ...r };
  } catch (e) {
    return failure(e);
  }
}
