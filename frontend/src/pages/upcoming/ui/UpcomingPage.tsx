// Écran prévu à un jalon suivant (docs/reecriture.md). Jamais d'impasse : la page dit
// ce qui arrive et renvoie vers l'accueil.
import { Link } from "react-router";
import { EmptyState } from "@/shared/ui/States";

const BUTTON = "inline-flex min-h-control items-center rounded-md border-2 border-black px-btn-x py-btn-y font-bold text-black no-underline hover:bg-black hover:text-white";

export function UpcomingPage({ title, milestone, home }: { title: string; milestone: number; home: string }) {
  return (
    <main className="flex flex-col gap-30">
      <h1>{title}</h1>
      <EmptyState
        headingLevel={2}
        title="Écran en préparation"
        actions={
          <Link className={BUTTON} to={home}>
            Retour à l&apos;accueil
          </Link>
        }
      >
        Cet écran arrive au jalon {milestone} de la réécriture. La navigation, les droits d&apos;accès et votre session sont déjà en place.
      </EmptyState>
    </main>
  );
}

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
