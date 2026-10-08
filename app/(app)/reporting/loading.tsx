// Chargement du reporting (E4) : trois indicateurs, deux graphiques et le tableau en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

const r = dict.reporting;

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1>{r.title}</h1>
      <p className="visually-hidden" role="status">{r.loading}</p>
      <div aria-hidden="true" className="ts-stack">
        <ul className="ts-kpis">
          {[0, 1, 2].map((i) => (
            <li key={i} className="card" style={{ gap: 5 }}>
              <Placeholder width={140} />
              <Placeholder width={120} height={34} />
              <Placeholder width={220} />
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <div className="card" style={{ flex: "3 1 480px", minWidth: 0 }}>
            <Placeholder width={260} height={22} />
            {[100, 60, 55, 25].map((w) => (
              <Placeholder key={w} width={`${w}%`} height={20} />
            ))}
          </div>
          <div className="card" style={{ flex: "2 1 320px", minWidth: 0 }}>
            <Placeholder width={240} height={22} />
            <Placeholder height={160} />
          </div>
        </div>
        <table className="table">
          <tbody>
            {[0, 1, 2, 3].map((i) => (
              <tr key={i}>
                <td><Placeholder width={200} /></td>
                <td><Placeholder width={80} /></td>
                <td><Placeholder width={60} /></td>
                <td><Placeholder width={60} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
