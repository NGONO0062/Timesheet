// Chargement de l'écran Projets (E4) : filtres réels, quatre lignes de tableau en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

const p = dict.project;

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1>{p.title}</h1>
        <Placeholder width={160} />
      </div>
      <p className="visually-hidden" role="status">{p.loading}</p>
      <div aria-hidden="true" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {[90, 110, 120, 110, 110].map((w, i) => (
          <Placeholder key={i} width={w} height={40} radius={6} />
        ))}
      </div>
      <div className="table-responsive" aria-hidden="true">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{p.colProject}</th>
              <th scope="col">{p.colStatus}</th>
              <th scope="col">{p.colPeriod}</th>
              <th scope="col">{p.colMembers}</th>
              <th scope="col">{p.colHours}</th>
              <th scope="col">{p.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {[220, 180, 200, 160].map((w) => (
              <tr key={w}>
                <td><Placeholder width={w} /></td>
                <td><Placeholder width={90} height={26} /></td>
                <td><Placeholder width={150} /></td>
                <td><Placeholder width={20} /></td>
                <td><Placeholder width={180} /></td>
                <td><Placeholder width={60} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
