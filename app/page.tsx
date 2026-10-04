import { redirect } from "next/navigation";

// Jalon 0 : l'application n'a encore que la page des composants.
// Au jalon 1, l'accueil renverra vers /connexion ou la page du rôle.
export default function Home() {
  redirect("/design");
}
