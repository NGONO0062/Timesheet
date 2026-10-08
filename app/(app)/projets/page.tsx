// Écran 9 : gestion des projets (PROMPT.md §9.4, planches 09-Projets, 09-Projets-colonnes,
// 09-Projets-creation).
import type { Metadata } from "next";
import { now } from "@/lib/clock";
import { listProjects } from "@/lib/data/projects";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { formatFrDate } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { todayInDivision } from "@/lib/iso-week";
import { ProjectsScreen } from "./ProjectsScreen";

export const metadata: Metadata = { title: dict.project.title };

type Props = { searchParams: Promise<{ vue?: string; statut?: string; archives?: string; projet?: string }> };

export default async function Page({ searchParams }: Props) {
  const viewer = await requirePermission("MANAGE_PROJECTS");
  const { projects, team } = await listProjects(scopeOf(viewer));
  const sp = await searchParams;
  return (
    <ProjectsScreen
      view={sp.vue === "colonnes" ? "board" : "list"}
      filter={["IN_PROGRESS", "NOT_STARTED", "ON_HOLD", "DONE"].includes(sp.statut ?? "") ? (sp.statut as "IN_PROGRESS") : "ALL"}
      showArchived={sp.archives === "1"}
      openId={projects.some((p) => p.id === sp.projet) ? sp.projet! : null}
      today={todayInDivision(now()).toISOString()}
      team={team}
      projects={projects.map((p) => ({
        ...p,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate?.toISOString() ?? null,
        start: formatFrDate(p.startDate),
        end: p.endDate ? formatFrDate(p.endDate) : "",
      }))}
    />
  );
}
