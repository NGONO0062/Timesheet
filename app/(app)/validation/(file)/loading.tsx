// Chargement de la file (E2) : filtres et cinq lignes de tableau en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

const v = dict.validation;

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <div className="ts-head-start">
        <h1>{v.title}</h1>
        <Placeholder width={110} height={26} />
      </div>
      <p className="visually-hidden" role="status">{v.loading}</p>
      <div aria-hidden="true" className="ts-filters">
        {[80, 70].map((w) => (
          <div key={w} className="ts-filter" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <Placeholder width={w} />
            <Placeholder height={40} radius={6} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {[160, 140, 130, 120].map((w) => (
          <Placeholder key={w} width={w} height={40} radius={6} />
        ))}
      </div>
      <div className="table-responsive" aria-hidden="true">
        <table className="table">
          <thead>
            <tr>
              <th scope="col" style={{ width: 40 }} />
              <th scope="col">{v.colPerson}</th>
              <th scope="col">{v.colWeek}</th>
              <th scope="col">{v.colHours}</th>
              <th scope="col">{v.colProjects}</th>
              <th scope="col">{v.colSubmitted}</th>
              <th scope="col">{v.colStatus}</th>
              <th scope="col">{v.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {[140, 110, 120, 150, 130].map((w) => (
              <tr key={w}>
                <td><Placeholder width={20} height={20} /></td>
                <td><Placeholder width={w} /></td>
                <td><Placeholder width={170} /></td>
                <td><Placeholder width={70} /></td>
                <td><Placeholder width={20} /></td>
                <td><Placeholder width={150} /></td>
                <td><Placeholder width={100} height={26} /></td>
                <td><Placeholder width={70} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
