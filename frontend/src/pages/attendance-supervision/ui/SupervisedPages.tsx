// Fiches de présence à signer (PROMPT.md §19) : onglet de l'écran Validation, puis la
// fiche (écran 06 repris côté superviseur). Un renvoi ramène à la liste avec un message.
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { monthLabel, supervisedHref, useSupervised, useSupervisedSheet, type SupervisedRow } from "@/entities/attendance";
import { useViewer } from "@/entities/viewer";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { formatDayMonth, formatTime, zonedDay } from "@/shared/lib/format";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Placeholder, Table } from "@/shared/ui/Display";
import { Breadcrumb } from "@/shared/ui/Navigation";
import { EmptyState } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { AttendanceScreen } from "@/widgets/attendance-sheet";
import { ValidationTabs } from "@/widgets/validation-tabs";

const a = dict.attendance;
const v = dict.validation;

const signedAt = (r: SupervisedRow) => {
  if (!r.internSignedAt) return "";
  const at = new Date(r.internSignedAt);
  return `${formatDayMonth(zonedDay(at))}, ${formatTime(at)}`;
};

export function SupervisedListPage() {
  const query = useSupervised();
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);

  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <h1>{v.title}</h1>
        <p className="sr-only" role="status">
          {v.loading}
        </p>
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="flex flex-col gap-30">
        <h1>{v.title}</h1>
        <Alert tone="danger" role="alert" heading={v.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
          <p>{v.errorText}</p>
        </Alert>
      </main>
    );
  }
  const data = query.data;
  return (
    <main className="flex flex-col gap-30">
      <h1>{v.title}</h1>
      <ValidationTabs current="presence" presenceCount={data.toSign} />
      {notice && (
        <Alert tone="success" role="status" onClose={() => setNotice(null)}>
          <p>{notice}</p>
        </Alert>
      )}
      <section aria-labelledby="titre-presence" className="flex flex-col gap-20">
        <h2 className="text-h3" id="titre-presence">
          {a.supervisorListTitle}
        </h2>
        {data.rows.length === 0 ? (
          <EmptyState title={a.supervisorEmptyTitle}>{a.supervisorEmptyText}</EmptyState>
        ) : (
          <Table caption={a.supervisorCaption}>
            <thead>
              <tr>
                <th scope="col">{a.colIntern}</th>
                <th scope="col">{a.colMonth}</th>
                <th scope="col">{a.colSigned}</th>
                <th scope="col">{a.colStatus}</th>
                <th scope="col">{a.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const month = monthLabel(r.year, r.month);
                return (
                  <tr key={r.id}>
                    <th scope="row">{r.name}</th>
                    <td>{month}</td>
                    <td className="whitespace-nowrap">{signedAt(r)}</td>
                    <td>
                      <StatusBadge kind="attendance" value={r.status} />
                    </td>
                    <td>
                      <Link to={supervisedHref(r.id)} aria-label={t(a.examineLabel, { name: r.name, month })}>
                        {r.status === "SIGNED_BY_INTERN" ? a.examine : a.consult}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </main>
  );
}

export function SupervisedSheetPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const viewer = useViewer().data;
  const query = useSupervisedSheet(id);
  const back = { label: v.title, href: "/validation/presence" };

  if (query.isPending || !viewer) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <Breadcrumb items={[back, { label: a.loading }]} />
        <p className="sr-only" role="status">
          {a.loading}
        </p>
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-sheet-h w-full" />
      </main>
    );
  }
  if (query.isError) {
    // Fiche hors de la portée, pas encore signée par le stagiaire, ou inconnue : 404.
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <main className="flex flex-col gap-30">
        <Breadcrumb items={[back, { label: gone ? v.goneTitle : a.errorTitle }]} />
        {gone ? (
          <EmptyState
            title={v.goneTitle}
            actions={
              <Link className={buttonClass()} to="/validation/presence">
                {a.backToList}
              </Link>
            }
          >
            {v.goneText}
          </EmptyState>
        ) : (
          <Alert tone="danger" role="alert" heading={a.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
            <p>{a.errorText}</p>
          </Alert>
        )}
      </main>
    );
  }
  const sheet = query.data;
  const title = t(a.supervisorDetailTitle, { name: sheet.internName, month: monthLabel(sheet.year, sheet.month) });
  return (
    <AttendanceScreen
      key={sheet.id}
      sheet={sheet}
      viewer={viewer}
      supervisor
      title={title}
      breadcrumb={[back, { label: title }]}
      onRejected={(name) => void navigate("/validation/presence", { state: { notice: t(a.rejected, { name }) } })}
    />
  );
}
