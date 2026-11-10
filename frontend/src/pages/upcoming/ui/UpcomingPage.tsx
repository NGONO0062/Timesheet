// Page « Page introuvable » : adresse inconnue, ou écran réservé à une autre permission.
import { Link } from "react-router";
import { EmptyState } from "@/shared/ui/States";

const BUTTON = "inline-flex min-h-control items-center rounded-md border-2 border-black px-btn-x py-btn-y font-bold text-black no-underline hover:bg-black hover:text-white";

/** Adresse inconnue, ou écran réservé à une autre permission : il n'existe pas pour l'utilisateur. */
export function NotFoundPage({ home }: { home: string }) {
  return (
    <main className="flex flex-col gap-30">
      <h1>Page introuvable</h1>
      <EmptyState
        headingLevel={2}
        title="Cette page n'existe pas"
        actions={
          <Link className={BUTTON} to={home}>
            Retour à l&apos;accueil
          </Link>
        }
      >
        L&apos;adresse est peut-être incomplète, ou cette page n&apos;est pas ouverte à votre profil.
      </EmptyState>
    </main>
  );
}
