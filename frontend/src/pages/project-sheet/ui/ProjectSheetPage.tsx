// Fiche projet (suivi de projet, non maquettée : docs/design-v2.md §7). Lecture seule : le
// projet se modifie dans le panneau de l'écran Projets (« Modifier »), les tâches depuis le tableau. Les chiffres viennent
// de la saisie (fiches soumises ou validées) ; aucun statut nouveau : les écarts sont écrits
// en phrases, sous « Points d'attention ».
import { Link, useParams } from "react-router";
import {
  attentionText,
  attentionTone,
  budgetDetail,
  budgetValue,
  projectPeriodLabel,
  shareOf,
  sheetTrendColumns,
  tasksByColumn,
  tasksValue,
  useProjectSheet,
  type ProjectSheet,
} from "@/entities/project";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { formatDays, formatPercent } from "@/shared/lib/format";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Mark, Placeholder, Progress, Table } from "@/shared/ui/Display";
import { Breadcrumb } from "@/shared/ui/Navigation";
import { EmptyState } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Columns } from "@/widgets/charts";

const s = dict.projectSheet;
const CARD = "flex flex-col gap-10 rounded-md border-2 border-gray-999 p-20";
const HOME = { label: dict.project.title, href: "/projets" };

function Attention({ sheet }: { sheet: ProjectSheet }) {
  return (
    <section className="flex flex-col gap-10" aria-labelledby="titre-attention">
      <h2 id="titre-attention" className="text-h3">
        {s.attentionTitle}
      </h2>
      {sheet.attention.length === 0 ? (
        <p className="flex items-start gap-10">
          <Mark tone="success" />
          {s.attentionNone}
        </p>
      ) : (
        <ul className="flex flex-col gap-10">
          {sheet.attention.map((code) => (
            <li key={code} className="flex items-start gap-10">
              <Mark tone={attentionTone(code)} />
              <span>{attentionText(code, sheet)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Indicators({ sheet }: { sheet: ProjectSheet }) {
  const over = sheet.budget !== null && sheet.consumed > sheet.budget;
  return (
    <ul aria-label={s.indicators} className="grid gap-20 md:grid-cols-3">
      <li className={CARD}>
        <span className="text-gray-595">{s.budget}</span>
        <span className="text-h1 font-bold">{budgetValue(sheet.consumed, sheet.budget)}</span>
        {sheet.budgetPercent !== null && <Progress value={sheet.budgetPercent} label={t(dict.project.budgetLabel, { name: sheet.name })} tone={over ? "danger" : undefined} />}
        <span className="text-sm">{budgetDetail(sheet.consumed, sheet.budget, sheet.budgetPercent)}</span>
        {sheet.pending > 0 && <span className="text-sm text-gray-595">{t(s.pending, { days: formatDays(sheet.pending) })}</span>}
      </li>
      <li className={CARD}>
        <span className="text-gray-595">{s.schedule}</span>
        <span className="text-h1 font-bold">{sheet.elapsedPercent === null ? s.noEndValue : formatPercent(sheet.elapsedPercent / 100)}</span>
        {sheet.elapsedPercent !== null && <Progress value={sheet.elapsedPercent} label={t(s.scheduleLabel, { name: sheet.name })} />}
        <span className="text-sm">{sheet.elapsedPercent === null ? s.noEnd : s.scheduleDetail}</span>
      </li>
      <li className={CARD}>
        <span className="text-gray-595">{s.tasks}</span>
        <span className="text-h1 font-bold">{tasksValue(sheet.tasks)}</span>
        {sheet.tasks.total > 0 && <Progress value={shareOf(sheet.tasks.done, sheet.tasks.total)} label={t(s.tasksLabel, { name: sheet.name })} tone={sheet.tasks.done === sheet.tasks.total ? "success" : undefined} />}
        <span className="text-sm">
          {sheet.tasks.total === 0
            ? s.tasksNoneHint
            : tasksByColumn(sheet.tasks)
                .map((c) => `${c.label} ${c.count}`)
                .join(" · ")}
        </span>
      </li>
    </ul>
  );
}

/** Tableau « libellé, jours, part du consommé » : équipe et activités. */
function Breakdown({ caption, column, rows, total }: { caption: string; column: string; rows: Array<{ key: string; label: string; note?: string; days: number }>; total: number }) {
  return (
    <Table caption={caption}>
      <thead>
        <tr>
          <th scope="col">{column}</th>
          <th scope="col" className="text-right">
            {s.colDays}
          </th>
          <th scope="col">{s.colShare}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">
              {r.label}
              {r.note && <span className="block text-sm font-normal text-gray-595">{r.note}</span>}
            </th>
            <td className="text-right whitespace-nowrap">{formatDays(r.days)}</td>
            <td>
              <div className="flex flex-col gap-5">
                <span>{formatPercent(shareOf(r.days, total) / 100)}</span>
                <Progress value={shareOf(r.days, total)} label={t(s.shareLabel, { name: r.label })} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Loaded({ sheet }: { sheet: ProjectSheet }) {
  const period = projectPeriodLabel(new Date(sheet.start), sheet.end ? new Date(sheet.end) : null);
  const meta = [sheet.code, period, sheet.manager ? t(s.manager, { name: sheet.manager }) : s.noManager, sheet.archived ? dict.project.archived : null].filter(Boolean).join(" · ");
  const trend = sheetTrendColumns(sheet.weeks);
  const people = sheet.people.map((p, i) => ({
    key: p.id ?? `autres-${i}`,
    label: p.name ?? s.others,
    note: p.name && !p.member ? s.notMember : undefined,
    days: p.days,
  }));

  return (
    <main className="flex flex-col gap-30">
      <Breadcrumb items={[HOME, { label: sheet.name }]} />
      <div className="flex flex-wrap items-start justify-between gap-x-20 gap-y-10">
        <div className="flex flex-col gap-10">
          <h1>{sheet.name}</h1>
          <p className="text-gray-595">{meta}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
          <StatusBadge kind="project" value={sheet.status} />
          <Link className={buttonClass()} to={`/projets?projet=${sheet.id}`} aria-label={t(dict.project.editLabel, { name: sheet.name })}>
            {dict.project.edit}
          </Link>
          <Link className={buttonClass()} to={`/taches?projet=${sheet.id}`}>
            {dict.tasks.seeTasks}
          </Link>
        </div>
      </div>

      <Attention sheet={sheet} />
      <Indicators sheet={sheet} />

      <div className="grid gap-30 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-20" aria-labelledby="titre-equipe">
          <h2 id="titre-equipe" className="text-h3">
            {s.teamTitle}
          </h2>
          {people.length === 0 ? <p>{s.teamEmpty}</p> : <Breakdown caption={s.teamCaption} column={s.colPerson} rows={people} total={sheet.consumed} />}
        </section>
        <section className="flex min-w-0 flex-col gap-20" aria-labelledby="titre-activites">
          <h2 id="titre-activites" className="text-h3">
            {s.activitiesTitle}
          </h2>
          <Breakdown caption={s.activitiesCaption} column={s.colActivity} rows={sheet.activities.map((a) => ({ key: a.name, label: a.name, days: a.days }))} total={sheet.consumed} />
        </section>
      </div>

      <figure className={CARD} aria-labelledby="titre-tendance-projet">
        <figcaption className="text-h4 font-bold" id="titre-tendance-projet">
          {s.trendTitle}
        </figcaption>
        <Columns columns={trend} label={trend.map((c) => c.title).join(" ; ")} />
        <p className="text-sm text-gray-595">{s.trendNote}</p>
      </figure>
    </main>
  );
}

export function ProjectSheetPage() {
  const { id = "" } = useParams();
  const query = useProjectSheet(id);
  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <Breadcrumb items={[HOME, { label: s.loading }]} />
        <p className="sr-only" role="status">
          {s.loading}
        </p>
        <Placeholder className="h-control w-1/2" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    // Projet hors de la portée ou inconnu : la même réponse (404).
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <main className="flex flex-col gap-30">
        <Breadcrumb items={[HOME, { label: gone ? s.goneTitle : s.errorTitle }]} />
        {gone ? (
          <EmptyState
            title={s.goneTitle}
            headingLevel={2}
            actions={
              <Link className={buttonClass()} to="/projets">
                {s.backToProjects}
              </Link>
            }
          >
            {s.goneText}
          </EmptyState>
        ) : (
          <Alert tone="danger" role="alert" heading={s.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
            <p>{s.errorText}</p>
          </Alert>
        )}
      </main>
    );
  }
  return <Loaded sheet={query.data} />;
}
