// Accès aux routes (PROMPT.md §6). L'API fait les vrais contrôles à chaque requête ;
// ici, l'interface évite seulement d'afficher ce qui serait refusé.
import { Navigate, Outlet, useLocation, useOutletContext } from "react-router";
import { homeFor, navigationFor, useViewer, type Viewer } from "@/entities/viewer";
import { LoginPage } from "@/pages/login";
import { NotFoundPage, UpcomingPage } from "@/pages/upcoming";
import { Spinner } from "@/shared/ui/Display";
import { AppShell } from "@/widgets/app-shell";

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}

/** Connexion : déjà connecté, on va directement à l'accueil du rôle. */
export function PublicOnly() {
  const viewer = useViewer();
  if (viewer.isPending) return <Loading />;
  if (viewer.data) return <Navigate to={homeFor(viewer.data)} replace />;
  return <LoginPage />;
}

/** Pages de l'application : sans session, retour à la connexion. */
export function Protected() {
  const viewer = useViewer();
  const location = useLocation();
  if (viewer.isPending) return <Loading />;
  if (!viewer.data) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  return (
    <AppShell viewer={viewer.data}>
      <Outlet context={viewer.data} />
    </AppShell>
  );
}

export function useCurrentViewer(): Viewer {
  return useOutletContext<Viewer>();
}

/** Racine : l'accueil du rôle (premier lien de sa navigation). */
export function Home() {
  return <Navigate to={homeFor(useCurrentViewer())} replace />;
}

/**
 * Écran d'un jalon suivant. Seul un lien de la navigation du profil (ou les Paramètres)
 * y mène ; sinon, la page n'existe pas pour lui.
 */
export function Upcoming({ href, title, milestone }: { href: string; title: string; milestone: number }) {
  const viewer = useCurrentViewer();
  const allowed = href === "/parametres" || navigationFor(viewer).some((item) => item.href === href);
  return allowed ? <UpcomingPage title={title} milestone={milestone} home={homeFor(viewer)} /> : <NotFoundPage home={homeFor(viewer)} />;
}

export function NotFound() {
  return <NotFoundPage home={homeFor(useCurrentViewer())} />;
}
