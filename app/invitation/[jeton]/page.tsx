// Première connexion par lien d'invitation (PROMPT.md §19, non maquetté) : même cadre
// que la page « Mot de passe oublié ».
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ods/Display";
import { Navbar } from "@/components/ods/Navigation";
import { now } from "@/lib/clock";
import { peekToken } from "@/lib/data/tokens";
import { dict, t } from "@/lib/i18n";
import { PasswordForm } from "../PasswordForm";

export const metadata: Metadata = { title: dict.account.inviteTitle };

const a = dict.account;

export default async function Page({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const account = await peekToken(jeton, "INVITATION", now());
  return (
    <div className="page page-plain">
      <Navbar href="/connexion" />
      <main className="container ts-stack" style={{ padding: "30px 0 60px", maxWidth: 600 }}>
        <h1>{a.inviteTitle}</h1>
        {account ? (
          <>
            <p>{t(a.inviteIntro, { name: account.firstName, email: account.email })}</p>
            <PasswordForm kind="INVITATION" token={jeton} />
          </>
        ) : (
          <Alert tone="danger" role="alert" heading={a.invalidTitle}>
            <p>{a.invalidInvite}</p>
            <p>
              <Link href="/connexion">{a.backToLogin}</Link>
            </p>
          </Alert>
        )}
      </main>
    </div>
  );
}
