import { createBrowserRouter, type RouteObject } from "react-router";
import { DashboardPage } from "@/pages/dashboard";
import { ProjectsPage } from "@/pages/projects";
import { ReportingPage } from "@/pages/reporting";
import { C1Page, C2aPage, C2bPage, C3Page, C4Page, DesignPage } from "@/pages/design";
import { ValidationQueuePage } from "@/pages/validation-queue";
import { ValidationReviewPage } from "@/pages/validation-review";
import { CurrentWeekRedirect, WeekEntryPage } from "@/pages/week-entry";
import { Home, NotFound, Protected, PublicOnly, RequirePermission, Upcoming } from "./guards";

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
  ["/division", "Vue division", 4],
  ["/fiche-presence", "Fiche de présence", 5],
  ["/administration", "Administration", 6],
  ["/parametres", "Paramètres", 6],
  ["/plateforme", "Divisions", 7],
  ["/plateforme/journal", "Journal d'audit", 7],
  ["/taches", "Tâches", 8],
];

const entry = (element: React.ReactNode) => <RequirePermission permission="ENTER_TIME">{element}</RequirePermission>;
const review = (element: React.ReactNode) => <RequirePermission permission="VALIDATE_TEAM">{element}</RequirePermission>;

/** Routes de l'application. Les écrans s'ajoutent jalon par jalon. */
export const router = createBrowserRouter([
  { path: "/connexion", element: <PublicOnly /> },
  {
    element: <Protected />,
    children: [
      { index: true, element: <Home /> },
      // Jalon 2 : saisie (écrans 02 à 05).
      { path: "/tableau-de-bord", element: entry(<DashboardPage />) },
      { path: "/saisie", element: entry(<CurrentWeekRedirect />) },
      { path: "/saisie/:year/:week", element: entry(<WeekEntryPage />) },
      // Jalon 3 : validation (écrans 07 et 08).
      { path: "/validation", element: review(<ValidationQueuePage />) },
      { path: "/validation/:id", element: review(<ValidationReviewPage />) },
      // Jalon 4 : pilotage (écrans 09 à 11).
      { path: "/projets", element: <RequirePermission permission="MANAGE_PROJECTS"><ProjectsPage /></RequirePermission> },
      { path: "/reporting", element: <RequirePermission permission="VIEW_REPORTING"><ReportingPage /></RequirePermission> },
      ...UPCOMING.map(([href, title, milestone]) => ({ path: href, element: <Upcoming href={href} title={title} milestone={milestone} /> })),
      { path: "*", element: <NotFound /> },
    ],
  },
  ...(import.meta.env.DEV ? design : []),
]);
