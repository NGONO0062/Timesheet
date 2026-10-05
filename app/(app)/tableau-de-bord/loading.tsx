// Chargement du tableau de bord (E2, E4) : deux lignes de liste, une carte,
// cinq lignes de liste, quatre lignes de tableau.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

const rows = (n: number, width: number) =>
  Array.from({ length: n }, (_, i) => (
    <li className="list-group-item" key={i}>
      <Placeholder width={width - i * 20} />
      <Placeholder width={120} height={40} radius={6} />
    </li>
  ));

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1 className="visually-hidden">{dict.dashboard.title}</h1>
      <p className="visually-hidden" role="status">{dict.dashboard.loading}</p>
      <div aria-hidden="true" className="ts-stack">
        <Placeholder width={260} height={34} />
        <ul className="list-group">{rows(2, 320)}</ul>
        <div className="card card-strong">
          <Placeholder width={200} height={26} />
          <Placeholder height={40} radius={6} />
          <Placeholder height={10} />
        </div>
        <ul className="list-group">{rows(5, 280)}</ul>
        <table className="table">
          <tbody>
            {Array.from({ length: 4 }, (_, i) => (
              <tr key={i}>
                <td><Placeholder width={100} /></td>
                <td><Placeholder width={140} /></td>
                <td><Placeholder width={70} /></td>
                <td><Placeholder width={100} height={26} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
