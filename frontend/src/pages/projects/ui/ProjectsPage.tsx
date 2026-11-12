// Écran 09 (planches 09-Projets, 09-Projets-colonnes, 09-Projets-creation ; PROMPT.md §9.4).
// Filtre, affichage et projets archivés sont gardés dans l'adresse. Le statut se change par
// l'étiquette (ou en glissant la carte en colonnes), tout de suite, avec « Annuler ».
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  budgetUsage,
  compareProjects,
  consumedText,
  projectPeriodLabel,
  projectSummary,
  ProjectStatusMenu,
  statusChangedMessage,
  useArchiveProject,
  useProjects,
  useProjectStatus,
  type Project,
} from "@/entities/project";
import { dayOf } from "@/entities/timesheet";
import { ProjectPanel } from "@/features/project-edit";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { PROJECT_STATUS_ORDER, statusLook, type ProjectStatus } from "@/shared/lib/status";
import { useBoardDrag } from "@/shared/lib/useBoardDrag";
import { Button } from "@/shared/ui/Button";
import { Alert, Mark, Placeholder, Progress, Table } from "@/shared/ui/Display";
import { Pills } from "@/shared/ui/Disclosure";
import { Switch } from "@/shared/ui/Form";
import { Icon } from "@/shared/ui/Icon";
import { EmptyState } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";

const p = dict.project;
type Filter = "ALL" | ProjectStatus;
type Notice = { text: string; undo?: () => void };

const parseFilter = (raw: string | null): Filter => (PROJECT_STATUS_ORDER as readonly string[]).includes(raw ?? "") ? (raw as ProjectStatus) : "ALL";
const periodOf = (x: Project) => projectPeriodLabel(dayOf(x.start), x.end ? dayOf(x.end) : null);

export function ProjectsPage() {
  const query = useProjects();
  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <h1>{p.title}</h1>
        <p className="sr-only" role="status">
          {p.loading}
        </p>
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="flex flex-col gap-30">
        <h1>{p.title}</h1>
        <Alert tone="danger" role="alert" heading={p.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
          <p>{p.errorText}</p>
        </Alert>
      </main>
    );
  }
  return <ProjectsView projects={query.data.projects} team={query.data.team} />;
}

function ProjectsView({ projects, team }: { projects: Project[]; team: Array<{ id: string; name: string }> }) {
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get("statut"));
  const board = params.get("vue") === "colonnes";
  const showArchived = params.get("archives") === "1";
  const status = useProjectStatus();
  const archive = useArchiveProject();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Projet ouvert à l'arrivée (« Voir le projet » de la vue division), puis panneau à la demande.
  const [panel, setPanel] = useState<{ project: Project | null } | null>(() => {
    const opened = projects.find((x) => x.id === params.get("projet"));
    return opened ? { project: opened } : null;
  });

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  }

  function changeStatus(project: Project, next: ProjectStatus) {
    setError(null);
    status.mutate(
      { id: project.id, status: next },
      {
        onSuccess: (r) =>
          setNotice({
            text: statusChangedMessage(project.name, next),
            undo: () =>
              status.mutate({ id: project.id, status: r.previous }, { onSuccess: () => setNotice({ text: p.undone }), onError: () => setError(p.actionError) }),
          }),
        onError: () => setError(p.actionError),
      },
    );
  }

  const drag = useBoardDrag<ProjectStatus>(board, (id, s) => {
    const project = projects.find((x) => x.id === id);
    if (project && project.status !== s) changeStatus(project, s);
  });

  const visible = projects.filter((x) => showArchived || !x.archived).sort(compareProjects);
  const count = (s: ProjectStatus) => visible.filter((x) => x.status === s).length;
  const rows = filter === "ALL" ? visible : visible.filter((x) => x.status === filter);

  const statusCell = (x: Project) => <ProjectStatusMenu projectName={x.name} value={x.status} canManage onChange={(s) => changeStatus(x, s)} />;

  const daysCell = (x: Project) => {
    const usage = budgetUsage(x.consumed, x.budget);
    return (
      <div className="flex flex-col gap-5">
        <span>{consumedText(x.consumed, x.budget)}</span>
        {usage && <Progress value={usage.percent} label={t(p.budgetLabel, { name: x.name })} tone={usage.overText ? "danger" : undefined} />}
        {usage?.overText && (
          <span className="flex items-center gap-5 text-sm font-bold">
            <Mark tone="danger" />
            {usage.overText}
          </span>
        )}
      </div>
    );
  };

  const period = (x: Project) => (
    <span className="flex flex-col gap-5">
      <span className="whitespace-nowrap">{periodOf(x)}</span>
      {x.endDatePassed && (
        <span className="flex items-center gap-5 text-sm font-bold">
          <Mark tone="warning" />
          {p.endDatePassed}
        </span>
      )}
    </span>
  );

  const editButton = (x: Project) => (
    <span className="flex flex-wrap items-center gap-x-20 gap-y-5">
      <Button variant="link" aria-label={t(p.editLabel, { name: x.name })} onClick={() => setPanel({ project: x })}>
        {p.edit}
      </Button>
      <Link to={`/projets/${x.id}`} aria-label={t(dict.projectSheet.seeSheetLabel, { name: x.name })}>
        {dict.projectSheet.seeSheet}
      </Link>
      <Link to={`/taches?projet=${x.id}`} aria-label={t(dict.tasks.seeTasksLabel, { name: x.name })}>
        {dict.tasks.seeTasks}
      </Link>
    </span>
  );

  const list =
    rows.length === 0 ? (
      <EmptyState
        headingLevel={2}
        title={visible.length === 0 ? p.emptyTitle : p.emptyFilterTitle}
        actions={
          visible.length === 0 ? (
            <Button onClick={() => setPanel({ project: null })}>{p.create}</Button>
          ) : (
            <Button onClick={() => go({ statut: null })}>{p.emptyFilterAction}</Button>
          )
        }
      >
        {visible.length === 0 ? p.emptyText : null}
      </EmptyState>
    ) : (
      <Table caption={filter === "ALL" ? p.captionAll : t(p.captionStatus, { status: statusLook("project", filter).label })}>
        <thead>
          <tr>
            <th scope="col">{p.colProject}</th>
            <th scope="col">{p.colStatus}</th>
            <th scope="col">{p.colPeriod}</th>
            <th scope="col" className="text-right">
              {p.colMembers}
            </th>
            <th scope="col" className="w-budget-col">
              {p.colHours}
            </th>
            <th scope="col">{p.colAction}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id}>
              <th scope="row">
                {x.name}
                <span className="block text-sm font-normal text-gray-595">{x.archived ? `${x.code} · ${p.archived}` : x.code}</span>
              </th>
              <td>{statusCell(x)}</td>
              <td>{period(x)}</td>
              <td className="text-right tabular-nums">{x.memberIds.length}</td>
              <td>{daysCell(x)}</td>
              <td>{editButton(x)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

  const columns = (
    <div className="flex flex-col gap-20">
      <div className="grid grid-cols-4 items-start gap-20">
        {PROJECT_STATUS_ORDER.map((s) => {
          const items = visible.filter((x) => x.status === s);
          return (
            <section
              key={s}
              className={cx("flex flex-col gap-10 rounded-md border-2 bg-gray-fa p-10", drag.over === s ? "border-black" : "border-gray-999")}
              aria-label={t(items.length > 1 ? p.columnLabelMany : p.columnLabelOne, { status: statusLook("project", s).label, n: items.length })}
              {...drag.column(s)}
            >
              <h2 className="flex items-center justify-between gap-10 text-base">
                <StatusBadge kind="project" value={s} />
                <span className="text-sm">{items.length}</span>
              </h2>
              {items.map((x) => (
                <article key={x.id} className="flex cursor-grab flex-col gap-10 rounded-md border-2 border-black bg-white p-10" {...drag.card(x.id)}>
                  <div className="flex flex-col gap-5">
                    <h3 className="text-base font-bold">{x.name}</h3>
                    <span className="text-sm text-gray-595">
                      {x.code} · {periodOf(x)}
                    </span>
                  </div>
                  {daysCell(x)}
                  <span className="text-sm">{t(x.memberIds.length > 1 ? p.membersMany : p.membersOne, { n: x.memberIds.length })}</span>
                  <div className="flex flex-wrap items-center justify-between gap-10">
                    {statusCell(x)}
                    {editButton(x)}
                  </div>
                </article>
              ))}
              {items.length === 0 && <p className="text-sm text-gray-595">{p.columnEmpty}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );

  return (
    <main className="flex flex-col gap-30">
      <div className="flex flex-wrap items-start justify-between gap-20">
        <div className="flex flex-col gap-10">
          <h1>{p.title}</h1>
          <p className="text-gray-595">{projectSummary(visible.length, count("IN_PROGRESS"))}</p>
        </div>
        <Button variant="primary" aria-expanded={panel !== null} onClick={() => setPanel({ project: null })}>
          <Icon name="plus" />
          {p.create}
        </Button>
      </div>

      <div className="flex flex-col gap-20">
        <div className="flex flex-wrap items-center justify-between gap-20">
          {board ? (
            <p className="hidden text-gray-595 lg:block">{p.dragHint}</p>
          ) : (
            <Pills
              label={p.filterLabel}
              value={filter}
              onChange={(f) => go({ statut: f === "ALL" ? null : f })}
              options={(["ALL", ...PROJECT_STATUS_ORDER] as Filter[]).map((f) => ({
                value: f,
                label: f === "ALL" ? t(p.filterAll, { n: visible.length }) : t(p.filterMany[f], { n: count(f) }),
              }))}
            />
          )}
          {/* Sous 1024 px, seul l'affichage en liste est proposé. */}
          <div className="hidden lg:inline-flex" role="group" aria-label={p.view}>
            {([
              ["list", p.viewList, !board, () => go({ vue: null })],
              ["board", p.viewBoard, board, () => go({ vue: "colonnes", statut: null })],
            ] as const).map(([key, label, active, onClick], i) => (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={onClick}
                className={cx(
                  "inline-flex min-h-control cursor-pointer items-center gap-10 border-2 border-black px-btn-x py-btn-y font-bold",
                  i === 0 ? "rounded-l-md" : "-ml-border rounded-r-md",
                  active ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white",
                )}
              >
                {active && <Icon name="check" size="glyph" />}
                {label}
              </button>
            ))}
          </div>
        </div>
        <Switch label={p.showArchived} text={p.showArchived} checked={showArchived} onChange={(e) => go({ archives: e.target.checked ? "1" : null })} />
      </div>

      {notice && (
        <Alert
          tone="success"
          role="status"
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
      {error && (
        <Alert tone="danger" role="alert" onClose={() => setError(null)}>
          <p>{error}</p>
        </Alert>
      )}

      {board ? (
        <>
          <div className="hidden lg:block">{columns}</div>
          <div className="lg:hidden">{list}</div>
        </>
      ) : (
        list
      )}

      {panel && (
        <ProjectPanel
          key={panel.project?.id ?? "nouveau"}
          project={panel.project}
          team={team}
          onClose={() => {
            setPanel(null);
            if (params.get("projet")) go({ projet: null });
          }}
          onSaved={(text, unarchiveId) => {
            setPanel(null);
            setNotice({
              text,
              undo: unarchiveId
                ? () => archive.mutate({ id: unarchiveId, archived: false }, { onSuccess: () => setNotice({ text: p.undone }), onError: () => setError(p.actionError) })
                : undefined,
            });
            if (!panel.project) go({ statut: null, projet: null });
            else if (params.get("projet")) go({ projet: null });
          }}
        />
      )}
    </main>
  );
}
