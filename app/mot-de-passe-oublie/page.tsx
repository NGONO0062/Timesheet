import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/ods/Navigation";

export const metadata: Metadata = { title: "Mot de passe oublié" };

// Non maquetté (PROMPT.md §19) : la réinitialisation par e-mail arrive avec les
// e-mails de l'application. En attendant, la page dit quoi faire.
export default function Page() {
  return (
    <div className="page page-plain">
      <Navbar href="/connexion" />
      <main className="container" style={{ display: "flex", flexDirection: "column", gap: 20, padding: "30px 0 60px", maxWidth: 600 }}>
        <h1>Mot de passe oublié</h1>
        <p>La réinitialisation par e-mail n&apos;est pas encore disponible. Demandez à l&apos;administrateur de votre division de vous renvoyer une invitation : elle vous permet de choisir un nouveau mot de passe.</p>
        <p>
          <Link href="/connexion">Retour à la connexion</Link>
        </p>
      </main>
    </div>
  );
}
