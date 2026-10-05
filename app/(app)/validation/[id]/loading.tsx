// Chargement du détail (E4) : grille en squelette, décision désactivée.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

const v = dict.validation;

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1 className="visually-hidden">{v.title}</h1>
      <p className="visually-hidden" role="status">{v.loading}</p>
      <div aria-hidden="true" className="ts-stack">
        <Placeholder width={360} height={34} />
        <Placeholder width={300} />
        <div className="table-responsive">
          <table className="ts-grid">
            <tbody>
              {[0, 1, 2].map((r) => (
                <tr key={r}>
                  <th scope="row"><Placeholder width={180 - r * 20} /></th>
                  {[0, 1, 2, 3, 4].map((d) => (
                    <td key={d}><Placeholder width={30} /></td>
                  ))}
                  <td><Placeholder width={40} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card card-strong" style={{ maxWidth: 590 }}>
          <Placeholder width={200} height={26} />
          <Placeholder width={160} />
          <Placeholder width={160} />
          <Placeholder width={180} height={40} radius={6} />
        </div>
      </div>
    </main>
  );
}
