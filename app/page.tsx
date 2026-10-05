import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

// Accueil : la page du rôle si l'utilisateur est connecté, sinon la connexion.
export default async function Home() {
  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/connexion");
}
