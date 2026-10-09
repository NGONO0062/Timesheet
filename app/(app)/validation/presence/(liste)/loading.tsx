// Chargement des fiches de présence à signer : onglets réels, tableau en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1>{dict.validation.title}</h1>
      <p className="visually-hidden" role="status">{dict.attendance.loading}</p>
      <div aria-hidden="true" className="ts-section">
        <Placeholder width={420} height={40} />
        <h2 className="h3">{dict.attendance.supervisorListTitle}</h2>
        {[220, 200, 180].map((w) => (
          <Placeholder key={w} width={w} />
        ))}
      </div>
    </main>
  );
}
