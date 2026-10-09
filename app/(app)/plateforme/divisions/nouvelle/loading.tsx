// Chargement de l'onboarding : titre et étapes réels, formulaire en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1>{dict.onboarding.title}</h1>
      <p className="visually-hidden" role="status">{dict.form.loading}</p>
      <div aria-hidden="true" className="ts-section">
        <Placeholder height={56} />
        <Placeholder width={360} height={30} />
        {[0, 1, 2].map((i) => (
          <Placeholder key={i} width={480} height={40} radius={6} />
        ))}
      </div>
    </main>
  );
}
