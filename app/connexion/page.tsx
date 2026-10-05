import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/ods/Navigation";
import { loginAsDemo } from "@/app/actions/auth";
import { getViewer } from "@/lib/data/viewer";
import { DEMO_ACCOUNTS, demoProfilesEnabled } from "@/lib/demo";
import { dict } from "@/lib/i18n";
import { homeFor } from "@/lib/navigation";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Connexion" };

const t = dict.login;

// Écran 1 (PROMPT.md §6) : la seule page sans navigation, en deux volets.
export default async function ConnexionPage() {
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer));

  return (
    <div className="ts-login">
      <aside className="ts-login-brand" aria-label={t.brandLabel}>
        <p className="h1 ts-login-wordmark">
          <Wordmark />
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <p className="h2 ts-login-tagline">{t.tagline}</p>
          <ol className="ts-login-steps">
            {t.steps.map((step, i) => (
              <li key={step.title}>
                <span className="ts-login-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <span className="fw-bold">{step.title}</span> {step.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="small ts-login-note">{t.note}</p>
      </aside>
      <main className="ts-login-main">
        <div className="ts-login-form">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h1 id="titre-connexion">{t.title}</h1>
            <p className="text-secondary">{t.intro}</p>
          </div>
          <LoginForm />
          <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 20, borderTop: "2px solid #999999" }}>
            <h2 className="h6">{t.firstTitle}</h2>
            <p className="small">{t.firstText}</p>
          </div>
          {demoProfilesEnabled() && (
            <div className="ts-todo" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p className="small fw-bold">{t.demoTitle}</p>
              <ul style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <form action={loginAsDemo}>
                      <input type="hidden" name="email" value={a.email} />
                      <button className="btn-link btn" type="submit">
                        {a.label}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <footer className="ts-login-foot">
          <Link href="/aide">Aide</Link>
          <Link href="/accessibilite">Accessibilité</Link>
          <Link href="/donnees-personnelles">Données personnelles</Link>
        </footer>
      </main>
    </div>
  );
}
