// Écran 06 du stagiaire (PROMPT.md §9.7, §9.8, planche 06-Fiche-RH).
// /fiche-presence : la fiche à signer d'abord, sinon la plus récente.
// /fiche-presence/:year/:month : la fiche du mois, avec la liste « Période ».
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { attendanceHref, monthLabel, useMyMonths, useMySheet } from "@/entities/attendance";
import { useViewer } from "@/entities/viewer";
import { dict, t } from "@/shared/i18n";
import { ApiError } from "@/shared/api/http";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Placeholder } from "@/shared/ui/Display";
import { SelectField } from "@/shared/ui/Form";
import { Breadcrumb } from "@/shared/ui/Navigation";
import { EmptyState } from "@/shared/ui/States";
import { AttendanceScreen } from "@/widgets/attendance-sheet";

const a = dict.attendance;
const BREADCRUMB = [{ label: dict.dashboard.title, href: "/tableau-de-bord" }, { label: a.navLabel }];

function Loading() {
  return (
    <main className="flex flex-col gap-30" aria-busy="true">
      <Breadcrumb items={BREADCRUMB} />
      <h1>{a.title}</h1>
      <p className="sr-only" role="status">
        {a.loading}
      </p>
      <Placeholder className="h-control w-full" />
      <Placeholder className="h-sheet-h w-full" />
    </main>
  );
}

function Failed({ retry }: { retry: () => void }) {
  return (
    <main className="flex flex-col gap-30">
      <Breadcrumb items={BREADCRUMB} />
      <h1>{a.title}</h1>
      <Alert tone="danger" role="alert" heading={a.errorTitle} action={<Button onClick={retry}>{dict.form.retry}</Button>}>
        <p>{a.errorText}</p>
      </Alert>
    </main>
  );
}

/** Lien de navigation « Fiche de présence ». */
export function AttendanceIndexPage() {
  const months = useMyMonths();
  if (months.isPending) return <Loading />;
  if (months.isError) return <Failed retry={() => void months.refetch()} />;
  const target = months.data.find((m) => m.status === "GENERATED") ?? months.data[0];
  if (target) return <Navigate to={attendanceHref(target.year, target.month)} replace />;
  return (
    <main className="flex flex-col gap-30">
      <h1>{a.title}</h1>
      <EmptyState
        headingLevel={2}
        title={a.emptyTitle}
        actions={
          <Link className={buttonClass()} to="/saisie">
            {a.emptyAction}
          </Link>
        }
      >
        {a.emptyText}
      </EmptyState>
    </main>
  );
}

const valid = (year: number, month: number) => Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;

export function AttendanceMonthPage() {
  const params = useParams();
  const year = Number(params.year);
  const month = Number(params.month);
  return valid(year, month) ? <MonthView key={`${year}-${month}`} year={year} month={month} /> : <NotReady year={year} month={month} invalid />;
}

function NotReady({ year, month, invalid }: { year: number; month: number; invalid?: boolean }) {
  return (
    <main className="flex flex-col gap-30">
      <Breadcrumb items={BREADCRUMB} />
      <h1>{a.title}</h1>
      <EmptyState headingLevel={2} title={invalid ? a.emptyTitle : t(a.notReadyTitle, { month: monthLabel(year, month).toLowerCase() })}>
        {a.notReadyText}
      </EmptyState>
    </main>
  );
}

function MonthView({ year, month }: { year: number; month: number }) {
  const navigate = useNavigate();
  const viewer = useViewer().data;
  const months = useMyMonths();
  const sheet = useMySheet(year, month);
  if (sheet.isPending || months.isPending || !viewer) return <Loading />;
  if (sheet.isError) {
    if (sheet.error instanceof ApiError && sheet.error.status === 404) return <NotReady year={year} month={month} />;
    return <Failed retry={() => void sheet.refetch()} />;
  }
  const periods = months.data ?? [];
  const period =
    periods.length > 0 ? (
      <div className="w-full md:w-week-filter">
        <SelectField
          label={a.period}
          value={attendanceHref(year, month)}
          onChange={(e) => {
            void navigate(e.target.value);
          }}
        >
          {periods.map((p) => (
            <option key={`${p.year}-${p.month}`} value={attendanceHref(p.year, p.month)}>
              {monthLabel(p.year, p.month)}
            </option>
          ))}
        </SelectField>
      </div>
    ) : undefined;
  return <AttendanceScreen key={sheet.data.id} sheet={sheet.data} viewer={viewer} title={a.title} breadcrumb={BREADCRUMB} period={period} />;
}
