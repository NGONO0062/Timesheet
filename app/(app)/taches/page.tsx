// Écran 15 : tableau Kanban d'un projet (PROMPT.md §9.12, non maquetté).
// Ouvert à qui saisit ses temps ou gère des projets ; sinon, la page n'existe pas.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBoard, listBoardProjects } from "@/lib/data/tasks";
import { requireViewer, scopeOf } from "@/lib/data/viewer";
import { dict } from "@/lib/i18n";
import { TasksScreen } from "./TasksScreen";

export const metadata: Metadata = { title: dict.tasks.title };

type Props = { searchParams: Promise<{ projet?: string }> };

export default async function Page({ searchParams }: Props) {
  const viewer = await requireViewer();
  if (!viewer.permissions.includes("ENTER_TIME") && !viewer.permissions.includes("MANAGE_PROJECTS")) notFound();
  const scope = scopeOf(viewer);
  const projects = await listBoardProjects(scope);
  const sp = await searchParams;
  // Un projet demandé hors de la portée n'existe pas pour l'utilisateur.
  if (sp.projet && !projects.some((p) => p.id === sp.projet)) notFound();
  const project = projects.find((p) => p.id === sp.projet) ?? projects[0] ?? null;
  const tasks = project ? await getBoard(scope, project.id) : [];
  return <TasksScreen key={project?.id ?? "aucun"} projects={projects} project={project} tasks={tasks} />;
}
