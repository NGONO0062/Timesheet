// Écran 12 : administration de la division (PROMPT.md §9.9, planche 12-Admin-division).
// Une page à ancres : Utilisateurs, Rôles et permissions, Workflows, Règles de saisie.
import type { Metadata } from "next";
import { getDivisionSettings, getMatrix, listManagers, listUsersPage } from "@/lib/data/admin";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { dict, t } from "@/lib/i18n";
import { DIVISION_ROLES } from "@/lib/permissions";
import { roleLabel } from "@/lib/viewer";
import { PermissionsSection, RulesSection, WorkflowSection } from "./SettingsSections";
import { UsersSection } from "./UsersSection";

export const metadata: Metadata = { title: dict.admin.title };

const a = dict.admin;

type Props = { searchParams: Promise<{ recherche?: string; page?: string }> };

export default async function Page({ searchParams }: Props) {
  const viewer = await requirePermission("ADMINISTER_DIVISION");
  const scope = scopeOf(viewer);
  const sp = await searchParams;
  const query = (sp.recherche ?? "").slice(0, 100);
  const [users, managers, matrix, settings] = await Promise.all([
    listUsersPage(scope, query, Number(sp.page ?? 1)),
    listManagers(scope),
    getMatrix(scope),
    getDivisionSettings(scope),
  ]);
  const roles = DIVISION_ROLES.map((r) => ({ value: r, label: roleLabel(r) }));
  const anchors = [
    { id: "utilisateurs", label: a.usersTitle },
    { id: "permissions", label: a.permissionsTitle },
    { id: "workflows", label: a.workflowTitle },
    { id: "regles", label: a.rulesTitle },
  ];

  return (
    <main className="container ts-stack">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1>{a.title}</h1>
        <p className="text-secondary">{t(a.intro, { division: settings.name })}</p>
      </div>
      <nav className="ts-anchors" aria-labelledby="sur-cette-page">
        <p id="sur-cette-page">{a.onThisPage}</p>
        {anchors.map((x) => (
          <a key={x.id} href={`#${x.id}`}>{x.label}</a>
        ))}
      </nav>
      <UsersSection view={{ ...users, query, managers, roles }} />
      <PermissionsSection initial={matrix} />
      <WorkflowSection initial={settings.workflow} />
      <RulesSection initial={settings.rules} />
    </main>
  );
}
