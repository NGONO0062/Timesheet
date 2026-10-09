import type { Metadata } from "next";
import { Navbar } from "@/components/ods/Navigation";
import { dict } from "@/lib/i18n";
import { ResetRequestForm } from "./ResetRequestForm";

export const metadata: Metadata = { title: dict.account.forgotTitle };

// Non maquetté (PROMPT.md §19) : demande d'un lien de réinitialisation par e-mail.
export default function Page() {
  return (
    <div className="page page-plain">
      <Navbar href="/connexion" />
      <main className="container ts-stack" style={{ padding: "30px 0 60px", maxWidth: 600 }}>
        <h1>{dict.account.forgotTitle}</h1>
        <p>{dict.account.forgotIntro}</p>
        <ResetRequestForm />
      </main>
    </div>
  );
}
