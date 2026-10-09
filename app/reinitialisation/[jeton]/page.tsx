// Nouveau mot de passe depuis le lien de réinitialisation (PROMPT.md §19, non maquetté).
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ods/Display";
import { Navbar } from "@/components/ods/Navigation";
import { now } from "@/lib/clock";
import { peekToken } from "@/lib/data/tokens";
import { dict, t } from "@/lib/i18n";
import { PasswordForm } from "../../invitation/PasswordForm";

export const metadata: Metadata = { title: dict.account.resetTitle };

const a = dict.account;

export default async function Page({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const account = await peekToken(jeton, "RESET", now());
  return (
    <div className="page page-plain">
      <Navbar href="/connexion" />
      <main className="container ts-stack" style={{ padding: "30px 0 60px", maxWidth: 600 }}>
        <h1>{a.resetTitle}</h1>
        {account ? (
          <>
            <p>{t(a.resetIntro, { email: account.email })}</p>
            <PasswordForm kind="RESET" token={jeton} />
          </>
        ) : (
          <Alert tone="danger" role="alert" heading={a.invalidTitle}>
            <p>{a.invalidReset}</p>
            <p>
              <Link href="/mot-de-passe-oublie">{a.newRequest}</Link>
            </p>
          </Alert>
        )}
      </main>
    </div>
  );
}
