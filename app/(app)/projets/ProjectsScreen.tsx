"use client";
// Écran 9 (09-Projets, 09-Projets-colonnes, 09-Projets-creation et prototype 09).
// Filtre, affichage et projets archivés sont gardés dans l'adresse. Le statut se
// change par l'étiquette, tout de suite, avec un message qui propose « Annuler ».
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveProject, saveProjectPanel, setProjectStatus } from "@/app/actions/projects";
import { Alert, Progress, Tag } from "@/components/ods/Display";
import { Checkbox, FieldError, Switch } from "@/components/ods/Form";
import { Icon, Mark } from "@/components/ods/Icon";
import { Offcanvas } from "@/components/ods/Overlay";
import { ProjectStatusMenu, StatusBadge } from "@/components/ts/StatusBadge";
import { cx } from "@/lib/cx";
import { dict, t } from "@/lib/i18n";
import {
  budgetUsage, checkProjectInput, compareProjects, consumedText, endDatePassed, projectPeriodLabel, projectSummary, statusChangedMessage,
  type ProjectFieldErrors, type ProjectInput,
} from "@/lib/projects/rules";
import { PROJECT_STATUS_ORDER, statusLook, type ProjectStatus } from "@/lib/status";

const p = dict.project;

export type ProjectItem = {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string | null;
  start: string;
  end: string;
  budgetHours: number | null;
  consumed: number;
  archived: boolean;
  memberIds: string[];
  activities: string[];
};

type Filter = "ALL" | ProjectStatus;
type Notice = { text: string; undo?: () => void };

export function ProjectsScreen(props: {
  view: "list" | "board";
  filter: Filter;
  showArchived: boolean;
  /** Projet ouvert dans le panneau à l'arrivée (« Voir le projet » de la vue division). */
  openId?: string | null;
  today: string;
  team: Array<{ id: string; name: string }>;
  projects: ProjectItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = new Date(props.today);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ project: ProjectItem | null } | null>(() => {
    const opened = props.projects.find((x) => x.id === props.openId);
    return opened ? { project: opened } : null;
  });
  const [, start] = useTransition();

  const visible = props.projects.filter((x) => props.showArchived || !x.archived).sort(compareProjects);
  const count = (s: ProjectStatus) => visible.filter((x) => x.status === s).length;
  const rows = props.filter === "ALL" ? visible : visible.filter((x) => x.status === props.filter);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function changeStatus(project: ProjectItem, status: ProjectStatus) {
    setError(null);
    start(async () => {
      const r = await setProjectStatus(project.id, status);
      if (!r.ok) return setError(p.actionError);
      const previous = r.previous;
      setNotice({
        text: statusChangedMessage(project.name, status),
        undo: () =>
          start(async () => {
            const back = await setProjectStatus(project.id, previous);
            if (back.ok) setNotice({ text: p.undone });
            else setError(p.actionError);
          }),
      });
    });
  }

  const statusCell = (x: ProjectItem) => (
    <ProjectStatusMenu projectName={x.name} value={x.status} canManage onChange={(s) => changeStatus(x, s)} />
  );

  const hoursCell = (x: ProjectItem) => {
    const usage = budgetUsage(x.consumed, x.budgetHours);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span>{consumedText(x.consumed, x.budgetHours)}</span>
        {usage && <Progress value={usage.percent} label={t(p.budgetLabel, { name: x.name })} tone={usage.overText ? "danger" : undefined} />}
        {usage?.overText && (
          <span className="small fw-bold" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Mark tone="danger" />
            {usage.overText}
          </span>
        )}
      </div>
    );
  };

  const period = (x: ProjectItem) => (
    <>
      {projectPeriodLabel(new Date(x.startDate), x.endDate ? new Date(x.endDate) : null)}
      {endDatePassed(x.status, x.endDate ? new Date(x.endDate) : null, today) && (
        <span className="small fw-bold" style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "normal" }}>
          <Mark tone="warning" />
          {p.endDatePassed}
        </span>
      )}
    </>
  );

  const editButton = (x: ProjectItem) => (
    <button className="btn btn-link" type="button" aria-label={t(p.editLabel, { name: x.name })} onClick={() => setPanel({ project: x })}>
      {p.edit}
    </button>
  );

  const list = rows.length === 0 ? (
    <div className="ts-empty">
      <p className="h5">{visible.length === 0 ? p.emptyTitle : p.emptyFilterTitle}</p>
      {visible.length === 0 ? (
        <>
          <p>{p.emptyText}</p>
          <button className="btn" type="button" onClick={() => setPanel({ project: null })}>{p.create}</button>
        </>
      ) : (
        <button className="btn" type="button" onClick={() => go({ statut: null })}>{p.emptyFilterAction}</button>
      )}
    </div>
  ) : (
    <div className="table-responsive">
      <table className="table">
        <caption className="visually-hidden">
          {props.filter === "ALL" ? p.captionAll : t(p.captionStatus, { status: statusLook("project", props.filter).label })}
        </caption>
        <thead>
          <tr>
            <th scope="col">{p.colProject}</th>
            <th scope="col" style={{ width: 150 }}>{p.colStatus}</th>
            <th scope="col">{p.colPeriod}</th>
            <th scope="col" className="num">{p.colMembers}</th>
            <th scope="col" style={{ width: 230 }}>{p.colHours}</th>
            <th scope="col">{p.colAction}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id}>
              <th scope="row">
                {x.name}
                <br />
                <span className="small text-secondary" style={{ fontWeight: 400 }}>
                  {x.archived ? `${x.code} · ${p.archived}` : x.code}
                </span>
              </th>
              <td>{statusCell(x)}</td>
              <td style={{ whiteSpace: "nowrap" }}>{period(x)}</td>
              <td className="num">{x.memberIds.length}</td>
              <td>{hoursCell(x)}</td>
              <td>{editButton(x)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const board = (
    <div className="ts-board">
      {PROJECT_STATUS_ORDER.map((s) => {
        const items = visible.filter((x) => x.status === s);
        const label = statusLook("project", s).label;
        return (
          <section key={s} className="ts-board-col" aria-label={t(items.length > 1 ? p.columnLabelMany : p.columnLabelOne, { status: label, n: items.length })}>
            <h2 className="h6 ts-board-head">
              <StatusBadge kind="project" value={s} />
              <span className="small">{items.length}</span>
            </h2>
            {items.map((x) => (
              <article key={x.id} className="ts-board-card">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <h3 className="h6">{x.name}</h3>
                  <span className="small text-secondary">
                    {x.code} · {projectPeriodLabel(new Date(x.startDate), x.endDate ? new Date(x.endDate) : null)}
                  </span>
                </div>
                {hoursCell(x)}
                <span className="small">{t(x.memberIds.length > 1 ? p.membersMany : p.membersOne, { n: x.memberIds.length })}</span>
                <div className="ts-head" style={{ gap: 10 }}>
                  {statusCell(x)}
                  {editButton(x)}
                </div>
              </article>
            ))}
            {items.length === 0 && <p className="ts-board-empty">{p.columnEmpty}</p>}
          </section>
        );
      })}
    </div>
  );

  return (
    <main className="container ts-stack">
      <div className="ts-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h1>{p.title}</h1>
          <p className="text-secondary">{projectSummary(visible.length, count("IN_PROGRESS"))}</p>
        </div>
        <button className="btn btn-primary" type="button" aria-expanded={panel !== null} onClick={() => setPanel({ project: null })}>
          <Icon name="plus" />
          {p.create}
        </button>
      </div>

      <div className="ts-section">
      <div className="ts-head">
        <ul className="nav nav-pills" aria-label={p.filterLabel}>
          {(["ALL", ...PROJECT_STATUS_ORDER] as Filter[]).map((f) => (
            <li key={f}>
              <button className={cx("nav-link", props.filter === f && "active")} type="button" aria-pressed={props.filter === f} onClick={() => go({ statut: f === "ALL" ? null : f })}>
                {f === "ALL" ? t(p.filterAll, { n: visible.length }) : t(p.filterMany[f], { n: count(f) })}
              </button>
            </li>
          ))}
        </ul>
        <div className="btn-group ts-lg-only" role="group" aria-label={p.view}>
            <button className={cx("btn", props.view === "list" && "active")} type="button" aria-pressed={props.view === "list"} onClick={() => go({ vue: null })}>
              {p.viewList}
            </button>
            <button className={cx("btn", props.view === "board" && "active")} type="button" aria-pressed={props.view === "board"} onClick={() => go({ vue: "colonnes" })}>
              {p.viewBoard}
            </button>
        </div>
      </div>
      <div className="ts-head-start" style={{ gap: 10 }}>
        <span className="small fw-bold" aria-hidden="true">{p.showArchived}</span>
        <Switch label={p.showArchived} checked={props.showArchived} onChange={(e) => go({ archives: e.target.checked ? "1" : null })} />
      </div>
      </div>

      {notice && (
        <Alert
          tone="success"
          role="status"
          action={notice.undo ? <button className="btn btn-link" type="button" onClick={() => { const u = notice.undo; setNotice(null); u?.(); }}>{dict.form.undo}</button> : undefined}
        >
          <p>{notice.text}</p>
        </Alert>
      )}
      {error && (
        <Alert tone="danger" role="alert">
          <p>{error}</p>
        </Alert>
      )}

      {props.view === "board" ? (
        <>
          <div className="ts-lg-only">{board}</div>
          {/* Sous 1024 px, seul l'affichage en liste est proposé. */}
          <div className="ts-lg-hide">{list}</div>
        </>
      ) : (
        list
      )}

      {panel && (
        <ProjectPanel
          key={panel.project?.id ?? "nouveau"}
          project={panel.project}
          team={props.team}
          onClose={() => {
            setPanel(null);
            if (props.openId) go({ projet: null });
          }}
          onSaved={(text, undo) => {
            setPanel(null);
            setNotice({ text, undo });
            if (!panel.project) go({ statut: null });
            else if (props.openId) go({ projet: null });
          }}
        />
      )}
    </main>
  );
}

const EMPTY: ProjectInput = { name: "", start: "", end: "", status: "NOT_STARTED", budget: "", activities: [], memberIds: [] };

/** Panneau de création et de modification (09-Projets-creation). */
function ProjectPanel({ project, team, onClose, onSaved }: {
  project: ProjectItem | null;
  team: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: (text: string, undo?: () => void) => void;
}) {
  const [form, setForm] = useState<ProjectInput>(() =>
    project
      ? { name: project.name, start: project.start, end: project.end, status: project.status, budget: project.budgetHours === null ? "" : String(project.budgetHours), activities: project.activities, memberIds: project.memberIds }
      : EMPTY,
  );
  const [activity, setActivity] = useState("");
  const [errors, setErrors] = useState<ProjectFieldErrors & { activityInUse?: string; activity?: string; global?: string }>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function addActivity() {
    const name = activity.trim();
    if (!name) return;
    if (form.activities.includes(name)) return setErrors((e) => ({ ...e, activity: p.errors.activityExists }));
    set("activities", [...form.activities, name]);
    setActivity("");
    setErrors((e) => ({ ...e, activity: undefined, activities: undefined }));
  }

  function submit() {
    const checked = checkProjectInput(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      const first = (["name", "start", "end", "budget", "activities"] as const).find((k) => checked.errors[k]);
      document.getElementById(`p-${first === "activities" ? "activite" : first}`)?.focus();
      return;
    }
    setErrors({});
    start(async () => {
      const r = await saveProjectPanel(project?.id ?? null, form);
      if (r.ok) {
        onSaved(project ? t(p.updated, { name: r.name }) : t(p.created, { name: r.name, status: statusLook("project", form.status).label }));
      } else if ("fields" in r) {
        setErrors(r.fields.activityInUse ? { activityInUse: t(p.errors.activityInUse, { name: r.fields.activityInUse }) } : r.fields);
      } else {
        setErrors({ global: r.error === "members" ? p.errors.members : r.error === "notFound" ? p.errors.notFound : p.actionError });
      }
    });
  }

  function archive(archived: boolean) {
    if (!project) return;
    start(async () => {
      const r = await archiveProject(project.id, archived);
      if (!r.ok) return setErrors({ global: p.actionError });
      onSaved(
        t(archived ? p.archivedNotice : p.unarchivedNotice, { name: r.name }),
        archived ? () => void archiveProject(project.id, false) : undefined,
      );
    });
  }

  const err = (id: string, text?: string) => (text ? <FieldError id={`${id}-erreur`}>{text}</FieldError> : null);
  const described = (...ids: Array<string | false | undefined>) => ids.filter(Boolean).join(" ") || undefined;

  return (
    <Offcanvas
      open
      onClose={onClose}
      title={project ? p.panelEdit : p.panelNew}
      closeLabel={p.closePanel}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      footer={
        <>
          {project && (
            <button className="btn" type="button" style={{ marginRight: "auto" }} disabled={pending} onClick={() => archive(!project.archived)}>
              {project.archived ? p.unarchive : p.archive}
            </button>
          )}
          <button className="btn" type="button" onClick={onClose}>{dict.form.cancel}</button>
          <button className="btn btn-primary" type="submit" disabled={pending}>{project ? p.submitEdit : p.submitCreate}</button>
        </>
      }
    >
      <p className="small text-secondary">{dict.form.requiredLegend}</p>
      {errors.global && (
        <Alert tone="danger" role="alert">
          <p>{errors.global}</p>
        </Alert>
      )}
      {project && (
        <p className="small">
          <span className="text-secondary">{p.code} : </span>
          <span className="fw-bold">{project.code}</span>
        </p>
      )}
      <div>
        <label className="form-label is-required" htmlFor="p-name">{p.name}</label>
        <input
          className={cx("form-control", errors.name && "is-invalid")}
          id="p-name"
          type="text"
          aria-required="true"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={described(errors.name && "p-name-erreur")}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
        {err("p-name", errors.name)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 20 }}>
        <div>
          <label className="form-label is-required" htmlFor="p-start">{p.start}</label>
          <input
            className={cx("form-control", errors.start && "is-invalid")}
            id="p-start"
            type="text"
            inputMode="numeric"
            aria-required="true"
            aria-invalid={errors.start ? true : undefined}
            aria-describedby={described("p-format", errors.start && "p-start-erreur")}
            value={form.start}
            onChange={(e) => set("start", e.target.value)}
          />
          {err("p-start", errors.start)}
        </div>
        <div>
          <label className="form-label" htmlFor="p-end">{p.end}</label>
          <input
            className={cx("form-control", errors.end && "is-invalid")}
            id="p-end"
            type="text"
            inputMode="numeric"
            aria-invalid={errors.end ? true : undefined}
            aria-describedby={described("p-format", errors.end && "p-end-erreur")}
            value={form.end}
            onChange={(e) => set("end", e.target.value)}
          />
          {err("p-end", errors.end)}
        </div>
      </div>
      <p className="form-text" id="p-format" style={{ marginTop: 0 }}>{p.dateFormat}</p>
      <div>
        <label className="form-label" htmlFor="p-statut">{p.status}</label>
        <select className="form-select" id="p-statut" aria-describedby="p-statut-aide" value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
          {(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "DONE"] as const).map((s) => (
            <option key={s} value={s}>{statusLook("project", s).label}</option>
          ))}
        </select>
        <p className="form-text" id="p-statut-aide">{p.statusHint}</p>
      </div>
      <div>
        <label className="form-label" htmlFor="p-budget">{p.budget}</label>
        <div className="input-group" style={{ maxWidth: 200 }}>
          <input
            className={cx("form-control", errors.budget && "is-invalid")}
            id="p-budget"
            type="text"
            inputMode="numeric"
            aria-invalid={errors.budget ? true : undefined}
            aria-describedby={described(errors.budget && "p-budget-erreur")}
            value={form.budget}
            onChange={(e) => set("budget", e.target.value)}
          />
          <span className="input-group-text">h</span>
        </div>
        {err("p-budget", errors.budget)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="form-label" htmlFor="p-activite" style={{ marginBottom: 0 }}>{p.activities}</label>
        {form.activities.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {form.activities.map((a) => (
              <Tag key={a} removeLabel={t(p.removeActivity, { name: a })} onRemove={() => set("activities", form.activities.filter((x) => x !== a))}>
                {a}
              </Tag>
            ))}
          </div>
        )}
        <div className="input-group">
          <input
            className={cx("form-control", (errors.activities || errors.activity) && "is-invalid")}
            id="p-activite"
            type="text"
            placeholder={p.newActivity}
            aria-invalid={errors.activities || errors.activity ? true : undefined}
            aria-describedby={described((errors.activities || errors.activity) && "p-activite-erreur", errors.activityInUse && "p-activite-usage")}
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addActivity();
              }
            }}
          />
          <button className="btn" type="button" onClick={addActivity}>{p.addActivity}</button>
        </div>
        {err("p-activite", errors.activities ?? errors.activity)}
        {errors.activityInUse && <FieldError id="p-activite-usage">{errors.activityInUse}</FieldError>}
      </div>
      <fieldset style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        <legend className="form-label" style={{ padding: 0 }}>{t(p.members, { n: form.memberIds.filter((m) => team.some((u) => u.id === m)).length, total: team.length })}</legend>
        {team.map((u) => (
          <Checkbox
            key={u.id}
            id={`m-${u.id}`}
            label={u.name}
            checked={form.memberIds.includes(u.id)}
            onChange={(e) => set("memberIds", e.target.checked ? [...form.memberIds, u.id] : form.memberIds.filter((m) => m !== u.id))}
          />
        ))}
      </fieldset>
    </Offcanvas>
  );
}
