// Journal d'audit (PROMPT.md §9.10, planche 13) : lecture seule. Filtres dans l'adresse ;
// une date mal écrite est signalée sous son champ et la période par défaut s'applique.
// Exports CSV, Excel et PDF avec les filtres de l'écran.
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { AUDIT_CATEGORIES, auditExportHref, auditQuery, parseAuditParams, useAudit, type AuditPage } from "@/entities/platform";
import { roleLabel } from "@/entities/viewer";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { formatDateTime } from "@/shared/lib/format";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Placeholder, Table } from "@/shared/ui/Display";
import { Dropdown } from "@/shared/ui/Dropdown";
import { CONTROL, InputGroup, SelectField, TextField } from "@/shared/ui/Form";
import { Icon } from "@/shared/ui/Icon";
import { Pagination } from "@/shared/ui/Navigation";
import { EmptyState } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";

const au = dict.audit;

type Draft = { division: string; type: string; from: string; to: string; q: string };

function Filters({ data, onApply }: { data: AuditPage; onApply: (d: Draft) => void }) {
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<Draft>({
    division: params.get("division") ?? "",
    type: params.get("type") ?? "",
    from: params.get("du") ?? data.from,
    to: params.get("au") ?? data.to,
    q: params.get("q") ?? "",
  });
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const error = (k: "from" | "to") => (data.errors[k] ? au.errors[data.errors[k] === "order" ? "order" : "date"] : undefined);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onApply(draft);
  }

  return (
    <form className="flex flex-col gap-20" aria-label={au.title} onSubmit={onSubmit} noValidate>
      <div className="grid gap-20 md:grid-cols-2 lg:grid-cols-4">
        <SelectField id="journal-division" label={au.division} value={draft.division} onChange={(e) => set({ division: e.target.value })}>
          <option value="">{au.allDivisions}</option>
          {data.divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <SelectField id="journal-type" label={au.type} value={draft.type} onChange={(e) => set({ type: e.target.value })}>
          <option value="">{au.allTypes}</option>
          {AUDIT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {au.categories[c]}
            </option>
          ))}
        </SelectField>
        <TextField id="journal-from" label={au.from} inputMode="numeric" placeholder="jj/mm/aaaa" value={draft.from} error={error("from")} aria-describedby="journal-note" onChange={(e) => set({ from: e.target.value })} />
        <TextField id="journal-to" label={au.to} inputMode="numeric" placeholder="jj/mm/aaaa" value={draft.to} error={error("to")} aria-describedby="journal-note" onChange={(e) => set({ to: e.target.value })} />
      </div>
      <div className="w-full md:w-week-filter">
        <label className="mb-5 block font-bold" htmlFor="journal-recherche">
          {au.search}
        </label>
        <InputGroup>
          <input id="journal-recherche" className={cx(CONTROL, "h-control rounded-l-md")} type="search" value={draft.q} onChange={(e) => set({ q: e.target.value })} />
          <Button type="submit">{au.filter}</Button>
        </InputGroup>
      </div>
      <p className="text-sm text-gray-595" id="journal-note">
        {au.note}
      </p>
    </form>
  );
}

export function AuditLog({ headingLevel = 2 }: { headingLevel?: 1 | 2 }) {
  const [params, setParams] = useSearchParams();
  const filters = parseAuditParams(params);
  const query = useAudit(filters);
  const H = headingLevel === 1 ? "h1" : "h2";

  function apply(d: Draft) {
    const next = auditQuery({ division: d.division || null, type: d.type || null, from: d.from.trim() || null, to: d.to.trim() || null, q: d.q.trim(), page: 1 });
    setParams(next);
  }

  const pageHref = (n: number) => {
    const p = auditQuery({ ...filters, page: n }, true);
    const qs = p.toString();
    return `?${qs}${headingLevel === 2 ? "#journal" : ""}`;
  };

  return (
    <section id="journal" aria-labelledby="titre-journal" className="flex scroll-mt-20 flex-col gap-20">
      <div className="flex flex-wrap items-center justify-between gap-20">
        <H id="titre-journal">{au.title}</H>
        <Dropdown
          label={au.export}
          buttonClassName={({ open }) => cx(buttonClass(), open && "bg-black text-white")}
          menuClassName="right-0"
          items={(["csv", "xlsx", "pdf"] as const).map((f) => ({
            key: f,
            content: <span aria-label={t(au.exportLabel, { format: au.exportFormats[f] })}>{au.exportFormats[f]}</span>,
            href: auditExportHref(filters, f),
          }))}
        >
          {au.export}
          <Icon name="down" size="glyph" />
        </Dropdown>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-20" aria-busy="true">
          <p className="sr-only" role="status">
            {au.loading}
          </p>
          <Placeholder className="h-control w-full" />
          <Placeholder className="h-pad w-full" />
        </div>
      ) : query.isError ? (
        <Alert tone="danger" role="alert" heading={au.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
          <p>{au.errorText}</p>
        </Alert>
      ) : (
        <>
          {/* Les filtres repartent de l'adresse à chaque changement de recherche. */}
          <Filters key={params.toString()} data={query.data} onApply={apply} />
          {query.data.total === 0 ? (
            <EmptyState title={au.empty}>{au.emptyHint}</EmptyState>
          ) : (
            <>
              <Table caption={au.caption}>
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
                  {query.data.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(new Date(r.at), true)}</td>
                      <th scope="row">
                        <span className="flex flex-col gap-5">
                          <span>{r.actor ?? au.unknownActor}</span>
                          {r.actorRole && <span className="text-sm font-normal text-gray-595">{roleLabel(r.actorRole)}</span>}
                        </span>
                      </th>
                      <td>{r.division ?? au.noDivision}</td>
                      <td>{r.actionLabel}</td>
                      <td className="wrap-anywhere">{r.objectLabel}</td>
                      <td>
                        <StatusBadge kind="audit" value={r.result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-20">
                <p className="text-sm">{t(au.range, { from: query.data.fromIndex, to: query.data.toIndex, total: query.data.total })}</p>
                <Pagination page={query.data.page} pageCount={query.data.count} href={pageHref} label={au.pagination} />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
