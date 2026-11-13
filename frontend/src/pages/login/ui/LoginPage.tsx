// Écran 1 : connexion (planches 01-Connexion, 01-Connexion-erreur, 01-Connexion-mobile).
// Bureau : colonne noire de présentation à gauche, formulaire à droite. Mobile : bandeau
// noir réduit en haut, formulaire, pied de page noir.
import { Link, useSearchParams } from "react-router";
import { DemoProfiles, SignInForm } from "@/features/auth";
import { dict } from "@/shared/i18n";
import { Alert } from "@/shared/ui/Display";
import { Wordmark } from "@/shared/ui/Wordmark";

const t = dict.login;

const FOOTER = [
  { label: "Aide", href: "/aide" },
  { label: "Accessibilité", href: "/accessibilite" },
  { label: "Données personnelles", href: "/donnees-personnelles" },
];

export function LoginPage() {
  // Retour d'une invitation ou d'une réinitialisation, ou des Paramètres (mot de passe modifié).
  const [params] = useSearchParams();
  const flag = params.get("mot-de-passe");
  const notice = flag === "enregistre" ? dict.account.passwordSet : flag === "modifie" ? dict.account.passwordChanged : null;

  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row md:flex-wrap md:items-stretch">
      {/* Mobile : contenu sur une colonne centrée de 312 px, comme la planche 01-Connexion-mobile. */}
      <aside
        className="flex flex-col items-center gap-10 bg-black px-20 py-30 text-white *:w-full *:max-w-mobile md:flex-brand md:items-stretch md:justify-between md:gap-60 md:p-60 md:*:max-w-none"
        aria-label={t.brandLabel}
      >
        <p className="text-h2 font-bold md:text-h1">
          <Wordmark bare />
        </p>
        <div className="flex flex-col gap-30">
          <p className="text-base md:text-h2 md:font-bold">{t.tagline}</p>
          <ol className="hidden flex-col gap-20 md:flex">
            {t.steps.map((step, i) => (
              <li key={step.title} className="flex items-start gap-20">
                <span className="flex size-control-sm flex-none items-center justify-center rounded-sm border-2 border-white font-bold" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <span className="font-bold">{step.title}</span> {step.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="hidden text-sm md:block">{t.note}</p>
      </aside>
      <main className="flex flex-1 flex-col items-center gap-30 px-20 pt-30 md:flex-login md:px-20 md:pt-60 md:pb-20">
        <div className="flex w-full max-w-mobile flex-col gap-30 md:my-auto md:max-w-login">
          <div className="flex flex-col gap-10">
            <h1 id="titre-connexion">{t.title}</h1>
            <p className="text-gray-595">{t.intro}</p>
          </div>
          {notice && (
            <Alert tone="success" role="status">
              <p>{notice}</p>
            </Alert>
          )}
          <SignInForm />
          <div className="flex flex-col gap-5 border-t-2 border-gray-999 pt-20">
            <h2 className="text-h6">{t.firstTitle}</h2>
            <p className="text-sm">{t.firstText}</p>
          </div>
          <DemoProfiles />
        </div>
        <footer className="-mx-20 self-stretch bg-black px-20 py-20 text-sm text-white md:mx-0 md:self-auto md:bg-transparent md:p-0 md:text-black">
          <div className="mx-auto flex w-full max-w-mobile flex-wrap gap-x-20 gap-y-10 md:max-w-none md:justify-center md:gap-x-30">
            {FOOTER.map((l) => (
              <Link key={l.href} to={l.href} className="text-white hover:text-primary md:text-black">
                {l.label}
              </Link>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
