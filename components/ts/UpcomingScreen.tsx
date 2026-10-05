// Écran prévu à un jalon suivant (PROMPT.md §21). Jamais d'impasse : la page dit
// ce qui arrive et renvoie vers l'accueil.
import Link from "next/link";
import { EmptyState } from "./States";

export function UpcomingScreen({ title, milestone, home }: { title: string; milestone: number; home: string }) {
  return (
    <main className="container" style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      <h1>{title}</h1>
      <EmptyState headingLevel={2} title="Écran en préparation" actions={<Link className="btn" href={home}>Retour à l&apos;accueil</Link>}>
        Cet écran arrive au jalon {milestone}. La navigation, les droits d&apos;accès et votre session sont déjà en place.
      </EmptyState>
    </main>
  );
}
