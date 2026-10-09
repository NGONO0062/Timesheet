// Chargement de l'administration plateforme (E4) : tableaux des divisions et du journal en squelette.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

function Rows({ widths, count }: { widths: number[]; count: number }) {
  return (
    <div className="table-responsive" aria-hidden="true">
      <table className="table">
        <tbody>
          {Array.from({ length: count }, (_, i) => (
            <tr key={i}>
              {widths.map((w, j) => (
                <td key={j}><Placeholder width={w} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1>{dict.platform.title}</h1>
      <p className="visually-hidden" role="status">{dict.platform.loading}</p>
      <Rows widths={[120, 100, 110, 30, 90, 80, 50]} count={2} />
      <h2 aria-hidden="true">{dict.audit.title}</h2>
      <Rows widths={[130, 110, 90, 120, 140, 60]} count={6} />
    </main>
  );
}
