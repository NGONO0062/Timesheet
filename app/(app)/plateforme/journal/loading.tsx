// Chargement du journal d'audit (E4) : filtres réels, tableau en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1>{dict.audit.title}</h1>
      <p className="visually-hidden" role="status">{dict.audit.loading}</p>
      <div aria-hidden="true" className="ts-section">
        <div className="ts-form-grid ts-form-grid-4">
          {[0, 1, 2, 3].map((i) => (
            <Placeholder key={i} height={40} radius={6} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Placeholder key={i} height={30} />
        ))}
      </div>
    </main>
  );
}
