import { Link } from "react-router";
import { Wordmark } from "@/shared/ui/Wordmark";

/** Page d'attente du socle : l'écran de connexion la remplace au jalon 1. */
export function HomePage() {
  return (
    <main className="flex flex-col gap-20 p-30">
      <h1>
        <Wordmark />
      </h1>
      <p>Réécriture sur la stack Orange : socle en place.</p>
      {import.meta.env.DEV && (
        <p>
          <Link to="/design">Composants</Link>
        </p>
      )}
    </main>
  );
}
