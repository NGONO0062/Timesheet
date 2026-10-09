// Chargement de la gestion d'une division : identité en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1 className="visually-hidden">{dict.platform.title}</h1>
      <p className="visually-hidden" role="status">{dict.platform.loading}</p>
      <div aria-hidden="true" className="ts-section">
        <Placeholder width={280} height={34} />
        <Placeholder width={600} height={220} radius={6} />
      </div>
    </main>
  );
}
