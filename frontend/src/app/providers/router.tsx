import { createBrowserRouter, type RouteObject } from "react-router";
import { C1Page, C4Page, DesignPage } from "@/pages/design";
import { HomePage } from "@/pages/home";

// Composants dans tous leurs états, à comparer aux planches de design/captures (développement seulement).
const design: RouteObject[] = [
  { path: "/design", element: <DesignPage /> },
  { path: "/design/c1", element: <C1Page /> },
  { path: "/design/c4", element: <C4Page /> },
];

/** Routes de l'application. Les écrans s'ajoutent jalon par jalon (docs/reecriture.md). */
export const router = createBrowserRouter([{ path: "/", element: <HomePage /> }, ...(import.meta.env.DEV ? design : [])]);
