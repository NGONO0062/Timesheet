import { createBrowserRouter, type RouteObject } from "react-router";
import { ForgotPasswordPage, LinkPasswordPage } from "@/pages/account";
import { AdminPage } from "@/pages/admin";
import { DashboardPage } from "@/pages/dashboard";
import { DivisionPage } from "@/pages/division";
import { ProjectsPage } from "@/pages/projects";
import { AuditPage, OnboardingPage, PlatformDivisionPage, PlatformPage } from "@/pages/platform";
import { ReportingPage } from "@/pages/reporting";
import { SettingsPage } from "@/pages/settings";
import { TasksPage } from "@/pages/tasks";
import { C1Page, C2aPage, C2bPage, C4Page, DesignPage } from "@/pages/design";
import { ValidationQueuePage } from "@/pages/validation-queue";
import { ValidationReviewPage } from "@/pages/validation-review";
import { CurrentWeekRedirect, WeekEntryPage } from "@/pages/week-entry";
import { Home, NotFound, Protected, PublicOnly, RequirePermission, RequirePlatformAdmin, RequireTasks } from "./guards";

// Composants dans tous leurs états, à comparer aux planches de design/captures (développement seulement).
const design: RouteObject[] = [
  { path: "/design", element: <DesignPage /> },
  { path: "/design/c1", element: <C1Page /> },
  { path: "/design/c2-a", element: <C2aPage /> },
  { path: "/design/c2-b", element: <C2bPage /> },
  { path: "/design/c4", element: <C4Page /> },
];

const entry = (element: React.ReactNode) => <RequirePermission permission="ENTER_TIME">{element}</RequirePermission>;
const review = (element: React.ReactNode) => <RequirePermission permission="VALIDATE_TEAM">{element}</RequirePermission>;

/** Routes de l'application. Les écrans s'ajoutent jalon par jalon. */
export const router = createBrowserRouter([
  { path: "/connexion", element: <PublicOnly /> },
  // Pages publiques (jalon 6) : mot de passe oublié, liens d'invitation et de réinitialisation.
  { path: "/mot-de-passe-oublie", element: <ForgotPasswordPage /> },
  { path: "/invitation/:token", element: <LinkPasswordPage kind="invitation" /> },
  { path: "/reinitialisation/:token", element: <LinkPasswordPage kind="reinitialisation" /> },
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
      { path: "/division", element: <RequirePermission permission="VIEW_DIVISION"><DivisionPage /></RequirePermission> },
      // Jalon 6 : administration de division (écran 12) et paramètres (écran 14).
      { path: "/administration", element: <RequirePermission permission="ADMINISTER_DIVISION"><AdminPage /></RequirePermission> },
      { path: "/parametres", element: <SettingsPage /> },
      // Jalon 7 : administration plateforme (écran 13), onboarding, journal d'audit.
      { path: "/plateforme", element: <RequirePlatformAdmin><PlatformPage /></RequirePlatformAdmin> },
      { path: "/plateforme/journal", element: <RequirePlatformAdmin><AuditPage /></RequirePlatformAdmin> },
      { path: "/plateforme/divisions/nouvelle", element: <RequirePlatformAdmin><OnboardingPage /></RequirePlatformAdmin> },
      { path: "/plateforme/divisions/:id", element: <RequirePlatformAdmin><PlatformDivisionPage /></RequirePlatformAdmin> },
      // Jalon 8 : tableau Kanban d'un projet (écran 15) : membres des projets et ceux qui les gèrent.
      { path: "/taches", element: <RequireTasks><TasksPage /></RequireTasks> },
      { path: "*", element: <NotFound /> },
    ],
  },
  ...(import.meta.env.DEV ? design : []),
]);
