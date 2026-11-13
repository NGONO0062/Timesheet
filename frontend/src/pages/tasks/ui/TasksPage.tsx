// Écran 15 : tableau Kanban d'un projet (PROMPT.md §9.12, non maquetté). Une carte se
// déplace en la glissant d'une colonne à l'autre, ou par son étiquette, au clavier comme
// au doigt. Déplacement et suppression sont immédiats, avec un message qui propose
// « Annuler ». Projet choisi dans l'adresse (?projet=).
import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router";
import {
  columnLabel,
  columnOf,
  movedMessage,
  TaskStatusMenu,
  titleError,
  useBoard,
  useBoardActions,
  useBoardProjects,
  type Board,
  type BoardProject,
  type BoardTask,
} from "@/entities/task";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { TASK_STATUS_ORDER, type TaskStatus } from "@/shared/lib/status";
import { useBoardDrag } from "@/shared/lib/useBoardDrag";
import { Button } from "@/shared/ui/Button";
import { Alert, Placeholder } from "@/shared/ui/Display";
import { SelectField, TextField } from "@/shared/ui/Form";
import { EmptyState } from "@/shared/ui/States";
import { StatusBadge } from "@/shared/ui/StatusBadge";

const k = dict.tasks;

type Notice = { text: string; undo?: () => void };

const CARD = "flex flex-col gap-10 rounded-md border-2 border-gray-999 bg-white p-10";

function BoardView({ board }: { board: Board }) {
  const project = board.project;
  const actions = useBoardActions(project.id);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; error?: string } | null>(null);
  const editable = board.editable;
  const drag = useBoardDrag<TaskStatus>(editable, (id, status) => {
    const task = board.tasks.find((x) => x.id === id);
    if (task) move(task, status);
  });

  const fail = () => setError(k.actionError);

  function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    actions.create.mutate(draft, {
      onSuccess: (r) => {
        setDraft("");
        setDraftError(null);
        setNotice({ text: t(k.created, { title: r.title }) });
      },
      onError: (err) => {
        const field = err instanceof ApiError ? (err.body as { fields?: string[] } | null)?.fields?.[0] : undefined;
        if (field) setDraftError(titleError(field));
        else fail();
      },
    });
  }

  function move(task: BoardTask, status: TaskStatus) {
    if (task.status === status) return;
    setError(null);
    actions.move.mutate(
      { id: task.id, status },
      {
        onSuccess: (r) =>
          setNotice({
            text: movedMessage(task.title, status),
            undo: () =>
              actions.move.mutate(
                { id: task.id, status: r.previousStatus, position: r.previousPosition },
                { onSuccess: () => setNotice({ text: k.undone }), onError: fail },
              ),
          }),
        onError: fail,
      },
    );
  }

  function rename(task: BoardTask, title: string) {
    setError(null);
    actions.rename.mutate(
      { id: task.id, title },
      {
        onSuccess: (r) => {
          setEditing(null);
          setNotice({ text: t(k.renamed, { title: r.title }) });
        },
        onError: (err) => {
          const field = err instanceof ApiError ? (err.body as { fields?: string[] } | null)?.fields?.[0] : undefined;
          if (field) setEditing({ id: task.id, title, error: titleError(field) });
          else fail();
        },
      },
    );
  }

  function remove(task: BoardTask) {
    setError(null);
    actions.remove.mutate(
      { id: task.id, deleted: true },
      {
        onSuccess: () =>
          setNotice({
            text: t(k.deleted, { title: task.title }),
            undo: () => actions.remove.mutate({ id: task.id, deleted: false }, { onSuccess: () => setNotice({ text: k.undone }), onError: fail }),
          }),
        onError: fail,
      },
    );
  }

  const card = (x: BoardTask) => (
    <article key={x.id} className={cx(CARD, editable && editing?.id !== x.id && "cursor-grab")} {...drag.card(x.id, editing?.id !== x.id)}>
      {editing?.id === x.id ? (
        <form
          className="flex flex-col gap-10"
          onSubmit={(e) => {
            e.preventDefault();
            rename(x, editing.title);
          }}
          noValidate
        >
          <TextField label={k.titleLabel} value={editing.title} error={editing.error} autoFocus onChange={(e) => setEditing({ id: x.id, title: e.target.value })} />
          <div className="flex flex-wrap items-center gap-10">
            <Button type="submit" size="sm" disabled={actions.rename.isPending}>
              {k.save}
            </Button>
            <Button variant="link" onClick={() => setEditing(null)}>
              {k.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          <h4 className="text-h6 wrap-anywhere">{x.title}</h4>
          {x.createdBy && <span className="text-sm text-gray-595">{t(k.by, { name: x.createdBy })}</span>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-10">
        <TaskStatusMenu taskTitle={x.title} value={x.status} canMove={editable} onChange={(s) => move(x, s)} />
        {editable && editing?.id !== x.id && (
          <>
            <Button variant="link" aria-label={t(k.renameLabel, { title: x.title })} onClick={() => setEditing({ id: x.id, title: x.title })}>
              {k.rename}
            </Button>
            <Button variant="link" aria-label={t(k.deleteLabel, { title: x.title })} onClick={() => remove(x)}>
              {k.delete}
            </Button>
          </>
        )}
      </div>
    </article>
  );

  return (
    <>
      <div className="flex flex-col gap-20">
        <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
          <h2 className="text-h4">{project.name}</h2>
          <StatusBadge kind="project" value={project.status} />
        </div>
        {editable && (
          <form className="flex flex-wrap items-start gap-x-20 gap-y-10" onSubmit={add} noValidate>
            <div className="w-full md:max-w-form md:flex-1">
              <TextField
                label={k.newTask}
                hint={k.addHint}
                error={draftError ?? undefined}
                value={draft}
                maxLength={200}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (draftError) setDraftError(null);
                }}
              />
            </div>
            <Button className="md:mt-text" variant="primary" type="submit" icon="plus" disabled={actions.create.isPending}>
              {k.add}
            </Button>
          </form>
        )}
      </div>

      {board.readOnlyReason && (
        <Alert tone="info">
          <p>{board.readOnlyReason === "archived" ? k.readOnlyArchived : k.readOnlyDone}</p>
        </Alert>
      )}
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

      {editable && <p className="text-sm text-gray-595">{k.dragHint}</p>}
      <div className="grid gap-20 lg:grid-cols-5 lg:items-start" role="group" aria-label={t(k.boardLabel, { name: project.name })}>
        {TASK_STATUS_ORDER.map((s) => {
          const items = columnOf(board.tasks, s);
          return (
            <section
              key={s}
              className={cx("flex min-w-0 flex-col gap-10 rounded-md border-2 bg-gray-fa p-10", drag.over === s ? "border-black" : "border-gray-ddd")}
              aria-label={columnLabel(s, items.length)}
              {...drag.column(s)}
            >
              <h3 className="flex items-center justify-between gap-10 text-h6">
                <StatusBadge kind="task" value={s} />
                <span className="text-sm tabular-nums">{items.length}</span>
              </h3>
              {items.map(card)}
              {items.length === 0 && <p className="text-sm text-gray-595">{k.columnEmpty}</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}

function ProjectPicker({ projects, current }: { projects: BoardProject[]; current: string }) {
  const [, setParams] = useSearchParams();
  return (
    <div className="w-full md:max-w-form">
      <SelectField label={k.project} value={current} onChange={(e) => setParams(new URLSearchParams({ projet: e.target.value }))}>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {t(k.projectOption, { code: p.code, name: p.name })}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

export function TasksPage() {
  const [params] = useSearchParams();
  const projects = useBoardProjects();
  const asked = params.get("projet");
  const list = projects.data ?? [];
  // Un projet demandé hors de la portée n'existe pas pour l'utilisateur.
  const unknown = asked !== null && projects.isSuccess && !list.some((p) => p.id === asked);
  const projectId = unknown ? null : (asked ?? list[0]?.id ?? null);
  const board = useBoard(projectId);

  const header = (
    <div className="flex flex-col gap-10">
      <h1>{k.title}</h1>
      <p className="text-gray-595">{k.intro}</p>
    </div>
  );

  if (projects.isPending || (projectId !== null && board.isPending)) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        {header}
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (projects.isError || board.isError) {
    const gone = board.error instanceof ApiError && board.error.status === 404;
    return (
      <main className="flex flex-col gap-30">
        {header}
        <Alert tone="danger" role="alert" action={<Button onClick={() => void (projects.isError ? projects.refetch() : board.refetch())}>{dict.form.retry}</Button>}>
          <p>{gone ? k.emptyText : k.actionError}</p>
        </Alert>
      </main>
    );
  }
  // Un projet hors de la portée n'existe pas : la page « Page introuvable » de l'application.
  if (unknown) return <Navigate to="/page-introuvable" replace />;
  if (!projectId || !board.data) {
    return (
      <main className="flex flex-col gap-30">
        {header}
        <EmptyState headingLevel={2} title={k.emptyTitle}>
          {k.emptyText}
        </EmptyState>
      </main>
    );
  }
  return (
    <main className="flex flex-col gap-30">
      {header}
      <ProjectPicker projects={list} current={projectId} />
      {/* Changer de projet repart d'un tableau neuf (saisie, messages). */}
      <BoardView key={projectId} board={board.data} />
    </main>
  );
}
