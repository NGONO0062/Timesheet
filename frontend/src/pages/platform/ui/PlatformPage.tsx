// Écran 13 : administration plateforme (PROMPT.md §9.10, planche 13-Admin-plateforme).
// Divisions, puis journal d'audit ; /plateforme/journal : le journal seul. Gestion d'une
// division (non maquettée) : identité, suspension ou réactivation avec « Annuler ».
import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import { useDivision, useDivisions, useDivisionStatus } from "@/entities/platform";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { formatShortDate, zonedDay } from "@/shared/lib/format";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Card, Placeholder, Table, Tag } from "@/shared/ui/Display";
import { Icon } from "@/shared/ui/Icon";
import { Breadcrumb } from "@/shared/ui/Navigation";
import { EmptyState } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { AuditLog } from "@/widgets/audit-log";

const p = dict.platform;

const created = (iso: string) => formatShortDate(zonedDay(new Date(iso)));

function Divisions() {
  const query = useDivisions();
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-20" aria-busy="true">
        <p className="sr-only" role="status">
          {p.loading}
        </p>
        <Placeholder className="h-pad w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Alert tone="danger" role="alert" heading={p.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
        <p>{p.errorText}</p>
      </Alert>
    );
  }
  if (query.data.length === 0) return <EmptyState title={p.empty}>{p.emptyHint}</EmptyState>;
  return (
    <Table caption={p.caption}>
      <thead>
        <tr>
          <th scope="col">{p.colDivision}</th>
          <th scope="col">{p.colTenant}</th>
          <th scope="col">{p.colAdmin}</th>
          <th scope="col" className="text-right">
            {p.colUsers}
          </th>
          <th scope="col">{p.colState}</th>
          <th scope="col">{p.colCreated}</th>
          <th scope="col">{p.colAction}</th>
        </tr>
      </thead>
      <tbody>
        {query.data.map((d) => (
          <tr key={d.id}>
            <th scope="row">
              <span className="flex flex-col items-start gap-5">
                {d.name}
                {d.pilot && <Tag>{p.pilot}</Tag>}
              </span>
            </th>
            <td>{d.slug}</td>
            <td className={d.admin ? undefined : "text-gray-595"}>{d.admin ?? p.adminPending}</td>
            <td className="text-right tabular-nums">{d.users}</td>
            <td>
              <StatusBadge kind="division" value={d.status} params={{ step: d.step }} />
            </td>
            <td>{created(d.createdAt)}</td>
            <td>
              {d.status === "ONBOARDING" ? (
                <Link to={`/plateforme/divisions/nouvelle?division=${d.id}`} aria-label={t(p.resumeLabel, { name: d.name })}>
                  {p.resume}
                </Link>
              ) : (
                <Link to={`/plateforme/divisions/${d.id}`} aria-label={t(p.manageLabel, { name: d.name })}>
                  {p.manage}
                </Link>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function PlatformPage() {
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);
  return (
    <main className="flex flex-col gap-60">
      <div className="flex flex-col gap-30">
        <div className="flex flex-wrap items-center justify-between gap-20">
          <h1>{p.title}</h1>
          <Link className={buttonClass("primary")} to="/plateforme/divisions/nouvelle">
            <Icon name="plus" />
            {p.add}
          </Link>
        </div>
        {notice && (
          <Alert tone="success" role="status" onClose={() => setNotice(null)}>
            <p>{notice}</p>
          </Alert>
        )}
        <Alert tone="info">
          <p>{p.isolation}</p>
        </Alert>
        <Divisions />
      </div>
      <AuditLog />
    </main>
  );
}

export function AuditPage() {
  return (
    <main className="flex flex-col gap-30">
      <AuditLog headingLevel={1} />
    </main>
  );
}

type Notice = { tone: "success" | "danger"; text: string; undo?: () => void } | null;

export function DivisionPage() {
  const { id = "" } = useParams();
  const query = useDivision(id);
  const status = useDivisionStatus(id);
  const [notice, setNotice] = useState<Notice>(null);

  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <Breadcrumb items={[{ label: p.title, href: "/plateforme" }, { label: p.loading }]} />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <main className="flex flex-col gap-30">
        <Breadcrumb items={[{ label: p.title, href: "/plateforme" }, { label: gone ? p.errors.notFound : p.errorTitle }]} />
        {gone ? (
          <Alert tone="danger" role="alert" heading={p.errors.notFound}>
            <p>
              <Link to="/plateforme">{p.title}</Link>
            </p>
          </Alert>
        ) : (
          <Alert tone="danger" role="alert" heading={p.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
            <p>{p.errorText}</p>
          </Alert>
        )}
      </main>
    );
  }
  const d = query.data;
  if (d.status === "ONBOARDING") return <Navigate to={`/plateforme/divisions/nouvelle?division=${d.id}`} replace />;

  function change(next: "ACTIVE" | "SUSPENDED", undoable = true) {
    setNotice(null);
    status.mutate(next, {
      onSuccess: (r) =>
        setNotice(
          undoable
            ? { tone: "success", text: t(next === "SUSPENDED" ? p.suspended : p.activated, { name: r.name }), undo: () => change(r.previous, false) }
            : { tone: "success", text: p.undone },
        ),
      onError: () => setNotice({ tone: "danger", text: p.errors.unknown }),
    });
  }

  const facts: Array<[string, ReactNode]> = [
    [p.tenant, d.slug],
    [p.direction, d.direction],
    [p.admins, d.admins.length ? d.admins.join(", ") : p.adminPending],
    [p.users, String(d.users)],
    [p.state, <StatusBadge key="etat" kind="division" value={d.status} params={{ step: d.step }} />],
    [p.createdOn, created(d.createdAt)],
  ];

  return (
    <main className="flex flex-col gap-30">
      <div className="flex flex-col gap-20">
        <Breadcrumb items={[{ label: p.title, href: "/plateforme" }, { label: d.name }]} />
        <h1>{d.name}</h1>
      </div>
      <Card muted className="max-w-modal" aria-labelledby="identite-division">
        <h2 className="text-h5" id="identite-division">
          {p.facts}
        </h2>
        <dl className="grid grid-cols-trace gap-x-20 gap-y-10">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-595">{k}</dt>
              <dd className="font-bold wrap-anywhere">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="flex flex-col items-start gap-20">
        <p>{p.manageIntro}</p>
        <Button disabled={status.isPending} onClick={() => change(d.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}>
          {d.status === "ACTIVE" ? p.suspend : p.activate}
        </Button>
      </div>
      {notice && (
        <Alert
          tone={notice.tone}
          role={notice.tone === "danger" ? "alert" : "status"}
          onClose={() => setNotice(null)}
          action={
            notice.undo ? (
              <Button
                variant="link"
                onClick={() => {
                  const undo = notice.undo;
                  setNotice(null);
                  undo?.();
                }}
              >
                {dict.form.undo}
              </Button>
            ) : undefined
          }
        >
          <p>{notice.text}</p>
        </Alert>
      )}
    </main>
  );
}
