"use client";
// Chargement de la saisie (E4) : en-tête de grille réel, trois lignes de cinq cellules en squelette.
import { useParams } from "next/navigation";
import { Placeholder } from "@/components/ods/Display";
import { formatDayMonth } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { addDays, mondayOf } from "@/lib/iso-week";
import { parseWeek } from "@/lib/routes";

export default function Loading() {
  const params = useParams<{ annee: string; semaine: string }>();
  const week = parseWeek(params.annee, params.semaine);
  const days = week ? Array.from({ length: 5 }, (_, i) => addDays(mondayOf(week), i)) : [];
  return (
    <main className="container ts-stack" aria-busy="true">
      <h1>
        <span className="ts-wide">{dict.entry.title}</span>
        <span className="ts-narrow">{dict.entry.titleShort}</span>
      </h1>
      <p className="visually-hidden" role="status">{dict.entry.loading}</p>
      <div className="table-responsive" aria-hidden="true">
        <table className="ts-grid">
          <thead>
            <tr>
              <th scope="col">{dict.grid.projectActivity}</th>
              {days.map((d) => (
                <th scope="col" key={d.toISOString()}>
                  {dict.weekdaysShort[(d.getUTCDay() + 6) % 7]}
                  <small>{formatDayMonth(d)}</small>
                </th>
              ))}
              <th scope="col" className="ts-col-total">{dict.grid.total}</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((r) => (
              <tr key={r}>
                <th scope="row"><Placeholder width={180 - r * 20} /></th>
                {days.map((d) => (
                  <td key={d.toISOString()}><Placeholder height={40} radius={6} /></td>
                ))}
                <td className="ts-total"><Placeholder width={40} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
