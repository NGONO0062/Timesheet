// Chargement de la vue division (E4) : quatre indicateurs, tableau des équipes,
// graphique et dérives en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

const d = dict.division;

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1>{d.screenTitle}</h1>
      <p className="visually-hidden" role="status">{d.loading}</p>
      <div aria-hidden="true" className="ts-stack">
        <ul className="ts-kpis ts-kpis-4">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="card" style={{ gap: 5 }}>
              <Placeholder width={140} />
              <Placeholder width={100} height={34} />
              <Placeholder width={180} />
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <div className="card" style={{ flex: "3 1 480px", minWidth: 0 }}>
            <Placeholder width={300} height={22} />
            {[0, 1, 2, 3].map((i) => (
              <Placeholder key={i} height={30} />
            ))}
          </div>
          <div className="card" style={{ flex: "2 1 320px", minWidth: 0 }}>
            <Placeholder width={260} height={22} />
            <Placeholder height={160} />
          </div>
        </div>
        <Placeholder width={200} height={30} />
        <table className="table">
          <tbody>
            {[0, 1, 2, 3].map((i) => (
              <tr key={i}>
                <td><Placeholder width={120} /></td>
                <td><Placeholder width={200} /></td>
                <td><Placeholder width={220} /></td>
                <td><Placeholder width={120} /></td>
                <td><Placeholder width={100} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
