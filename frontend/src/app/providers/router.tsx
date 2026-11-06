import { createBrowserRouter, type RouteObject } from "react-router";
import { C1Page, C2aPage, C2bPage, C3Page, C4Page, DesignPage } from "@/pages/design";
import { Home, NotFound, Protected, PublicOnly, Upcoming } from "./guards";

// Composants dans tous leurs états, à comparer aux planches de design/captures (développement seulement).
const design: RouteObject[] = [
  { path: "/design", element: <DesignPage /> },
  { path: "/design/c1", element: <C1Page /> },
  { path: "/design/c2-a", element: <C2aPage /> },
  { path: "/design/c2-b", element: <C2bPage /> },
  { path: "/design/c3", element: <C3Page /> },
  { path: "/design/c4", element: <C4Page /> },
];

/** Écrans des jalons suivants (docs/reecriture.md) : présents dans la navigation, en préparation. */
const UPCOMING: Array<[href: string, title: string, milestone: number]> = [
  ["/tableau-de-bord", "Tableau de bord", 2],
  ["/saisie", "Saisie hebdomadaire", 2],
  ["/validation", "Validation", 3],
  ["/projets", "Projets", 4],
  ["/reporting", "Reporting", 4],
  ["/division", "Vue division", 4],
  ["/fiche-presence", "Fiche de présence", 5],
  ["/administration", "Administration", 6],
  ["/parametres", "Paramètres", 6],
  ["/plateforme", "Divisions", 7],
  ["/plateforme/journal", "Journal d'audit", 7],
  ["/taches", "Tâches", 8],
];

/** Routes de l'application. Les écrans s'ajoutent jalon par jalon. */
export const router = createBrowserRouter([
  { path: "/connexion", element: <PublicOnly /> },
  {
    element: <Protected />,
    children: [
      { index: true, element: <Home /> },
      ...UPCOMING.map(([href, title, milestone]) => ({ path: href, element: <Upcoming href={href} title={title} milestone={milestone} /> })),
      { path: "*", element: <NotFound /> },
    ],
  },
  ...(import.meta.env.DEV ? design : []),
]);
