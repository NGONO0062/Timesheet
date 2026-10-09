// Chargement de la fiche de présence (E4) : titre, circuit et feuille en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

const a = dict.attendance;

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1>{a.title}</h1>
      <p className="visually-hidden" role="status">{a.loading}</p>
      <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Placeholder width={200} />
        <div style={{ display: "flex", gap: 5 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1 }}>
              <Placeholder height={40} />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="ts-viewer">
        <div className="ts-viewer-stage">
          <div style={{ width: "100%", maxWidth: 940, aspectRatio: "297 / 210" }}>
            <Placeholder height={560} />
          </div>
        </div>
      </div>
    </main>
  );
}
