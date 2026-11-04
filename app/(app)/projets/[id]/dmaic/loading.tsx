// Chargement du suivi DMAIC (E2) : la structure de la page en placeholders.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1 className="visually-hidden">{dict.dmaic.title}</h1>
      <p className="visually-hidden" role="status">{dict.dmaic.loading}</p>
      <div aria-hidden="true" className="ts-stack">
        <Placeholder width={120} />
        <Placeholder width={360} height={34} />
        <Placeholder width="100%" height={50} radius={6} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Placeholder width={220} height={26} />
            <Placeholder width="80%" />
            <Placeholder width="60%" />
          </div>
        ))}
      </div>
    </main>
  );
}
