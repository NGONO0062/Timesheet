// Navigation par rôle (PROMPT.md §6). Elle se calcule à partir des permissions
// effectives, pas du nom du rôle : un manager qui peut saisir ses temps voit
// aussi les liens Staff.
import type { NavIconName } from "@/components/ods/Icon";
import type { Viewer } from "./viewer";

export type NavItem = { href: string; label: string; icon: NavIconName };

export function navigationFor(viewer: Pick<Viewer, "role" | "permissions" | "isIntern">): NavItem[] {
  if (viewer.role === "PLATFORM_ADMIN") {
    return [
      { href: "/plateforme", label: "Divisions", icon: "divisions" },
      { href: "/plateforme/journal", label: "Journal d'audit", icon: "audit" },
    ];
  }
  const can = (p: Viewer["permissions"][number]) => viewer.permissions.includes(p);
  const items: NavItem[] = [];
  if (can("ENTER_TIME")) {
    items.push({ href: "/tableau-de-bord", label: "Tableau de bord", icon: "dashboard" });
    items.push({ href: "/saisie", label: "Saisie hebdomadaire", icon: "entry" });
    // Staff non stagiaire : pas de fiche de présence RH, lien masqué (§20).
    if (viewer.isIntern) items.push({ href: "/fiche-presence", label: "Fiche de présence", icon: "attendance" });
  }
  if (can("ADMINISTER_DIVISION")) items.push({ href: "/administration", label: "Administration", icon: "admin" });
  if (can("VIEW_DIVISION")) items.push({ href: "/division", label: "Vue division", icon: "division" });
  if (can("VALIDATE_TEAM")) items.push({ href: "/validation", label: "Validation", icon: "validation" });
  if (can("MANAGE_PROJECTS")) items.push({ href: "/projets", label: "Projets", icon: "projects" });
  if (can("VIEW_REPORTING")) items.push({ href: "/reporting", label: "Reporting", icon: "reporting" });
  return items;
}

/** Page d'accueil : le premier lien de la navigation, sinon les paramètres. */
export function homeFor(viewer: Pick<Viewer, "role" | "permissions" | "isIntern">): string {
  return navigationFor(viewer)[0]?.href ?? "/parametres";
}

/** Lien courant : la page elle-même ou une de ses sous-pages. */
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/plateforme") return pathname === href || pathname.startsWith("/plateforme/divisions");
  return pathname === href || pathname.startsWith(`${href}/`);
}
