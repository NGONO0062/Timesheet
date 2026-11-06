import { createBrowserRouter } from "react-router";
import { DesignPage } from "@/pages/design";
import { HomePage } from "@/pages/home";

/** Routes de l'application. Les écrans s'ajoutent jalon par jalon (docs/reecriture.md). */
export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  // Composants dans tous leurs états, à comparer aux planches C1 à C4 (développement seulement).
  ...(import.meta.env.DEV ? [{ path: "/design", element: <DesignPage /> }] : []),
]);
