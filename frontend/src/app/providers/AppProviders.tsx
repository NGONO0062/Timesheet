import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";

/** Fournisseurs de l'application : cache des données (TanStack Query) et routage. */
export function AppProviders() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Une donnée d'écran se relit au retour sur l'onglet ; pas de nouvel essai sur une erreur de droits.
          queries: { staleTime: 30_000, retry: (count, error) => count < 2 && !(error instanceof Error && /40[134]/.test(error.message)) },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
