// Journal d'audit (PROMPT.md §9.10, planche 13) : lecture seule. Filtres par l'adresse
// (formulaire GET, sans script) ; une date mal écrite est signalée sous son champ et la
// période par défaut s'applique.
import { Pagination } from "@/components/ods/Navigation";
import { FieldError } from "@/components/ods/Form";
import { EmptyState } from "@/components/ts/States";
import { StatusBadge } from "@/components/ts/StatusBadge";
import { AUDIT_CATEGORIES } from "@/lib/audit/catalog";
import { auditQuery, type AuditFilters } from "@/lib/audit/filters";
import type { listAudit } from "@/lib/data/platform";
import { formatDateTime } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { roleLabel } from "@/lib/viewer";
import { AuditExport } from "./AuditExport";

const au = dict.audit;

export function AuditLog({ path, filters, errors, result, divisions, headingLevel = 2 }: {
  /** Page qui porte le journal : /plateforme (ancre #journal) ou /plateforme/journal. */
  path: string;
  filters: AuditFilters;
  errors: { from?: string; to?: string };
  result: Awaited<ReturnType<typeof listAudit>>;
  divisions: Array<{ id: string; name: string }>;
  headingLevel?: 1 | 2;
}) {
  const H = headingLevel === 1 ? "h1" : "h2";
  const query = auditQuery(filters).toString();
  const anchor = path === "/plateforme" ? "#journal" : "";
  const href = (n: number) => `${path}?${query}${n > 1 ? `&page=${n}` : ""}${anchor}`;

  return (
    <section id="journal" aria-labelledby="titre-journal" className="ts-section">
      <div className="ts-head">
        <H id="titre-journal">{au.title}</H>
        <AuditExport query={query} />
      </div>

      <form method="get" action={`${path}${anchor}`} className="ts-section" aria-label={au.title}>
        <div className="ts-form-grid ts-form-grid-4">
          <div>
            <label className="form-label" htmlFor="journal-division">{au.division}</label>
            <select id="journal-division" name="division" className="form-select" defaultValue={filters.divisionId ?? ""}>
              <option value="">{au.allDivisions}</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="journal-type">{au.type}</label>
            <select id="journal-type" name="type" className="form-select" defaultValue={filters.category ?? ""}>
              <option value="">{au.allTypes}</option>
              {(Object.keys(AUDIT_CATEGORIES) as Array<keyof typeof AUDIT_CATEGORIES>).map((c) => (
                <option key={c} value={c}>{au.categories[c]}</option>
              ))}
            </select>
          </div>
          {(["from", "to"] as const).map((k) => (
            <div key={k}>
              <label className="form-label" htmlFor={`journal-${k}`}>{au[k]}</label>
              <input
                id={`journal-${k}`}
                name={k === "from" ? "du" : "au"}
                className={errors[k] ? "form-control is-invalid" : "form-control"}
                inputMode="numeric"
                placeholder="jj/mm/aaaa"
                defaultValue={k === "from" ? filters.fromText : filters.toText}
                aria-invalid={errors[k] ? true : undefined}
                aria-describedby={[errors[k] ? `journal-${k}-erreur` : null, "journal-note"].filter(Boolean).join(" ")}
              />
              {errors[k] && <FieldError id={`journal-${k}-erreur`}>{errors[k]}</FieldError>}
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 240 }}>
          <label className="form-label" htmlFor="journal-recherche">{au.search}</label>
          <div className="input-group">
            <input id="journal-recherche" name="q" className="form-control" type="search" defaultValue={filters.q} />
            <button className="btn" type="submit">{au.filter}</button>
          </div>
        </div>
        <p className="small text-secondary" id="journal-note">{au.note}</p>
      </form>

      {result.total === 0 ? (
        <EmptyState title={au.empty}>{au.emptyHint}</EmptyState>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table">
              <caption className="visually-hidden">{au.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{au.colAt}</th>
                  <th scope="col">{au.colActor}</th>
                  <th scope="col">{au.colDivision}</th>
                  <th scope="col">{au.colAction}</th>
                  <th scope="col">{au.colObject}</th>
                  <th scope="col">{au.colResult}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.at, true)}</td>
                    <th scope="row">
                      {r.actor ?? au.unknownActor}
                      {r.actorRole && <span className="ts-user-email">{roleLabel(r.actorRole)}</span>}
                    </th>
                    <td>{r.division ?? au.noDivision}</td>
                    <td>{au.actions[r.action]}</td>
                    <td style={{ overflowWrap: "anywhere" }}>{r.objectLabel}</td>
                    <td><StatusBadge kind="audit" value={r.result} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ts-head">
            <p className="small">{t(au.range, { from: result.from, to: result.to, total: result.total })}</p>
            <Pagination page={result.page} pageCount={result.count} href={href} label={au.pagination} />
          </div>
        </>
      )}
    </section>
  );
}
