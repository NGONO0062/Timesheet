// Chargement de l'écran Paramètres : titre réel, blocs en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1>{dict.settings.title}</h1>
        <Placeholder width={320} />
      </div>
      <p className="visually-hidden" role="status">{dict.settings.loading}</p>
      <div className="ts-cards-2" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="card card-muted">
            {[160, 240, 200, 220].map((w) => (
              <Placeholder key={w} width={w} />
            ))}
          </div>
        ))}
      </div>
      <div className="ts-section" aria-hidden="true">
        <Placeholder width={220} height={30} />
        <Placeholder width={480} height={40} radius={6} />
      </div>
    </main>
  );
}
