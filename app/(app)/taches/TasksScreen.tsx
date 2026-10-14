"use client";
// Écran 15 : tableau Kanban d'un projet (PROMPT.md §9.12). Une carte se déplace en la
// glissant d'une colonne à l'autre, ou par son étiquette, au clavier comme au doigt.
// Déplacement et suppression sont immédiats, avec un message qui propose « Annuler ».
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { addTask, deleteTask, moveTaskTo, renameTaskTo, type TaskActionError } from "@/app/actions/tasks";
import { Alert } from "@/components/ods/Display";
import { SelectField, TextField } from "@/components/ods/Form";
import { Icon } from "@/components/ods/Icon";
import { StatusBadge, TaskStatusMenu } from "@/components/ts/StatusBadge";
import { useBoardDrag } from "@/components/ts/useBoardDrag";
import { cx } from "@/lib/cx";
import type { BoardProject, BoardTask } from "@/lib/data/tasks";
import { dict, t } from "@/lib/i18n";
import { TASK_STATUS_ORDER, type TaskStatus } from "@/lib/status";
import { boardEditable, columnLabel, columnOf, movedMessage, moveLocally, readOnlyReason } from "@/lib/tasks/rules";

const k = dict.tasks;

type Notice = { text: string; undo?: () => void };
type Op =
  | { kind: "add"; task: BoardTask }
  | { kind: "move"; id: string; status: TaskStatus; position?: number }
  | { kind: "rename"; id: string; title: string }
  | { kind: "delete"; id: string };

function reduce(state: BoardTask[], op: Op): BoardTask[] {
  switch (op.kind) {
    case "add":
      return [...state, op.task];
    case "move":
      return moveLocally(state, op.id, op.status, op.position);
    case "rename":
      return state.map((x) => (x.id === op.id ? { ...x, title: op.title } : x));
    case "delete":
      return state.filter((x) => x.id !== op.id);
  }
}

export function TasksScreen({ projects, project, tasks }: { projects: BoardProject[]; project: BoardProject | null; tasks: BoardTask[] }) {
  const router = useRouter();
  const pathname = usePathname();
  // Vue tout de suite à jour ; elle revient aux données du serveur à la fin de chaque action.
  const [view, apply] = useOptimistic(tasks, reduce);
  const [, start] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; error?: string } | null>(null);
  const drag = useBoardDrag<TaskStatus>(project !== null && boardEditable(project), (id, status) => {
    const task = view.find((x) => x.id === id);
    if (task) move(task, status);
  });

  if (!project) {
    return (
      <main className="container ts-stack">
        <h1>{k.title}</h1>
        <div className="ts-empty">
          <p className="h5">{k.emptyTitle}</p>
          <p>{k.emptyText}</p>
        </div>
      </main>
    );
  }

  const editable = boardEditable(project);
  const reason = readOnlyReason(project);

  const fail = (r: { error: TaskActionError } | { field: string }) => setError("field" in r ? r.field : k.actionError);

  function add(e: FormEvent) {
    e.preventDefault();
    const title = draft;
    setError(null);
    start(async () => {
      apply({ kind: "add", task: { id: `nouvelle-${Date.now()}`, title: title.trim(), status: "BACKLOG", position: Number.MAX_SAFE_INTEGER, createdBy: "" } });
      const r = await addTask(project!.id, title);
      if (!r.ok) {
        if ("field" in r) setDraftError(r.field);
        else setError(k.actionError);
        return;
      }
      setDraft("");
      setDraftError(null);
      setNotice({ text: t(k.created, { title: r.title }) });
    });
  }

  function move(task: BoardTask, status: TaskStatus) {
    if (task.status === status) return;
    setError(null);
    start(async () => {
      apply({ kind: "move", id: task.id, status });
      const r = await moveTaskTo(task.id, status);
      if (!r.ok) return fail(r);
      const previous = r.previous;
      setNotice({
        text: movedMessage(task.title, status),
        undo: () =>
          start(async () => {
            apply({ kind: "move", id: task.id, status: previous.status, position: previous.position });
            const back = await moveTaskTo(task.id, previous.status, previous.position);
            if (back.ok) setNotice({ text: k.undone });
            else fail(back);
          }),
      });
    });
  }

  function rename(task: BoardTask, title: string) {
    setError(null);
    start(async () => {
      apply({ kind: "rename", id: task.id, title: title.trim() });
      const r = await renameTaskTo(task.id, title);
      if (!r.ok) {
        if ("field" in r) setEditing({ id: task.id, title, error: r.field });
        else setError(k.actionError);
        return;
      }
      setEditing(null);
      setNotice({ text: t(k.renamed, { title: r.title }) });
    });
  }

  function remove(task: BoardTask) {
    setError(null);
    start(async () => {
      apply({ kind: "delete", id: task.id });
      const r = await deleteTask(task.id, true);
      if (!r.ok) return fail(r);
      setNotice({
        text: t(k.deleted, { title: task.title }),
        undo: () =>
          start(async () => {
            const back = await deleteTask(task.id, false);
            if (back.ok) setNotice({ text: k.undone });
            else fail(back);
          }),
      });
    });
  }

  const card = (x: BoardTask) => (
    <article
      key={x.id}
      className={cx("ts-board-card", editable && "ts-drag")}
      {...drag.card(x.id, editing?.id !== x.id)}
    >
      {editing?.id === x.id ? (
        <form
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            rename(x, editing.title);
          }}
        >
          <TextField label={k.titleLabel} value={editing.title} error={editing.error} autoFocus onChange={(e) => setEditing({ id: x.id, title: e.target.value })} />
          <div className="ts-head-start" style={{ gap: 10 }}>
            <button className="btn" type="submit">{k.save}</button>
            <button className="btn btn-link" type="button" onClick={() => setEditing(null)}>{k.cancel}</button>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <h4 className="h6">{x.title}</h4>
          {x.createdBy && <span className="small text-secondary">{t(k.by, { name: x.createdBy })}</span>}
        </div>
      )}
      <div className="ts-head-start" style={{ gap: 10, flexWrap: "wrap" }}>
        <TaskStatusMenu taskTitle={x.title} value={x.status} canMove={editable} onChange={(s) => move(x, s)} />
        {editable && editing?.id !== x.id && (
          <>
            <button className="btn btn-link" type="button" aria-label={t(k.renameLabel, { title: x.title })} onClick={() => setEditing({ id: x.id, title: x.title })}>
              {k.rename}
            </button>
            <button className="btn btn-link" type="button" aria-label={t(k.deleteLabel, { title: x.title })} onClick={() => remove(x)}>
              {k.delete}
            </button>
          </>
        )}
      </div>
    </article>
  );

  return (
    <main className="container ts-stack">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1>{k.title}</h1>
        <p className="text-secondary">{k.intro}</p>
      </div>

      <div className="ts-section">
        <div style={{ maxWidth: 480 }}>
          <SelectField label={k.project} value={project.id} onChange={(e) => router.push(`${pathname}?projet=${e.target.value}`)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{t(k.projectOption, { code: p.code, name: p.name })}</option>
            ))}
          </SelectField>
        </div>
        <div className="ts-head-start" style={{ gap: 10 }}>
          <h2 className="h4">{project.name}</h2>
          <StatusBadge kind="project" value={project.status} />
        </div>
        {editable && (
          <form className="ts-task-new" onSubmit={add} noValidate>
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
            <button className="btn btn-primary" type="submit">
              <Icon name="plus" />
              {k.add}
            </button>
          </form>
        )}
      </div>

      {reason && (
        <Alert tone="info">
          <p>{reason}</p>
        </Alert>
      )}
      {notice && (
        <Alert
          tone="success"
          role="status"
          onClose={() => setNotice(null)}
          action={notice.undo ? <button className="btn btn-link" type="button" onClick={() => { const u = notice.undo; setNotice(null); u?.(); }}>{dict.form.undo}</button> : undefined}
        >
          <p>{notice.text}</p>
        </Alert>
      )}
      {error && (
        <Alert tone="danger" role="alert" onClose={() => setError(null)}>
          <p>{error}</p>
        </Alert>
      )}

      {editable && <p className="small text-secondary">{k.dragHint}</p>}
      <div className="ts-kanban" role="group" aria-label={t(k.boardLabel, { name: project.name })}>
        {TASK_STATUS_ORDER.map((s) => {
          const items = columnOf(view, s);
          return (
            <section key={s} className={cx("ts-kanban-col", drag.over === s && "is-over")} aria-label={columnLabel(s, items.length)} {...drag.column(s)}>
              <h3 className="h6 ts-board-head">
                <StatusBadge kind="task" value={s} />
                <span className="small">{items.length}</span>
              </h3>
              {items.map(card)}
              {items.length === 0 && <p className="ts-board-empty">{k.columnEmpty}</p>}
            </section>
          );
        })}
      </div>
    </main>
  );
}
