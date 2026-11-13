// Panneau de création et de modification d'un projet (planche 09-Projets-creation) : Offcanvas
// à droite, la liste reste visible derrière. Erreurs sous les champs, focus sur la première.
// L'archivage se fait d'ici (réversible).
import { useState } from "react";
import { checkProjectForm, fieldErrors, useArchiveProject, useSaveProject, type Project, type ProjectFieldErrors, type ProjectForm } from "@/entities/project";
import { dayOf } from "@/entities/timesheet";
import { ApiError } from "@/shared/api/http";
import { dict, t } from "@/shared/i18n";
import { formatFrDate } from "@/shared/lib/format";
import { PROJECT_STATUS_ORDER, statusLook, type ProjectStatus } from "@/shared/lib/status";
import { Button } from "@/shared/ui/Button";
import { Alert, Tag } from "@/shared/ui/Display";
import { Checkbox, FieldError, InputGroup, InputGroupText, RequiredLegend, SelectField, TextField } from "@/shared/ui/Form";
import { Offcanvas } from "@/shared/ui/Overlay";

const p = dict.project;
const EMPTY: ProjectForm = { name: "", start: "", end: "", status: "NOT_STARTED", budget: "", activities: [], memberIds: [] };
const ID = { name: "p-nom", start: "p-debut", end: "p-fin", budget: "p-budget", activities: "p-activite" } as const;

type Errors = ProjectFieldErrors & { activity?: string; activityInUse?: string; global?: string };

function formOf(project: Project | null): ProjectForm {
  if (!project) return EMPTY;
  return {
    name: project.name,
    start: formatFrDate(dayOf(project.start)),
    end: project.end ? formatFrDate(dayOf(project.end)) : "",
    status: project.status,
    budget: project.budget === null ? "" : String(project.budget),
    activities: project.activities,
    memberIds: project.memberIds,
  };
}

export function ProjectPanel({ project, team, onClose, onSaved }: {
  project: Project | null;
  team: Array<{ id: string; name: string }>;
  onClose: () => void;
  /** Message affiché par l'écran ; `unarchiveId` : projet à sortir des archives si l'on annule. */
  onSaved: (text: string, unarchiveId?: string) => void;
}) {
  const [form, setForm] = useState<ProjectForm>(() => formOf(project));
  const [activity, setActivity] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const save = useSaveProject();
  const archive = useArchiveProject();
  const pending = save.isPending || archive.isPending;
  const set = <K extends keyof ProjectForm>(k: K, v: ProjectForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  function focusFirst(e: Errors) {
    const first = (["name", "start", "end", "budget", "activities"] as const).find((k) => e[k]);
    if (first) document.getElementById(ID[first])?.focus();
  }

  function addActivity() {
    const name = activity.trim();
    if (!name) return;
    if (form.activities.includes(name)) return setErrors((e) => ({ ...e, activity: p.errors.activityExists }));
    set("activities", [...form.activities, name]);
    setActivity("");
    setErrors((e) => ({ ...e, activity: undefined, activities: undefined }));
  }

  function submit() {
    const checked = checkProjectForm(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirst(checked.errors);
      return;
    }
    setErrors({});
    save.mutate(
      { id: project?.id ?? null, body: checked.value },
      {
        onSuccess: (r) => onSaved(project ? t(p.updated, { name: r.name }) : t(p.created, { name: r.name, status: statusLook("project", form.status).label })),
        onError: (err) => {
          const body = err instanceof ApiError ? (err.body as { code?: string; fields?: string[]; value?: string } | null) : null;
          if (body?.code === "invalid" && body.fields) {
            const e = fieldErrors(body.fields);
            setErrors(e);
            focusFirst(e);
          } else if (body?.code === "activityInUse") setErrors({ activityInUse: t(p.errors.activityInUse, { name: body.value ?? "" }) });
          else if (body?.code === "members") setErrors({ global: p.errors.members });
          else if (err instanceof ApiError && err.status === 404) setErrors({ global: p.errors.notFound });
          else setErrors({ global: p.actionError });
        },
      },
    );
  }

  function toggleArchive() {
    if (!project) return;
    const archived = !project.archived;
    archive.mutate(
      { id: project.id, archived },
      {
        onSuccess: (r) =>
          onSaved(t(archived ? p.archivedNotice : p.unarchivedNotice, { name: r.name }), archived ? project.id : undefined),
        onError: () => setErrors({ global: p.actionError }),
      },
    );
  }

  const inTeam = form.memberIds.filter((m) => team.some((u) => u.id === m)).length;

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
            <Button className="mr-auto" disabled={pending} onClick={toggleArchive}>
              {project.archived ? p.unarchive : p.archive}
            </Button>
          )}
          <Button onClick={onClose}>{dict.form.cancel}</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {project ? p.submitEdit : p.submitCreate}
          </Button>
        </>
      }
    >
      <RequiredLegend />
      {errors.global && (
        <Alert tone="danger" role="alert" onClose={() => setErrors((x) => ({ ...x, global: undefined }))}>
          <p>{errors.global}</p>
        </Alert>
      )}
      {project && (
        <p className="text-sm">
          <span className="text-gray-595">{p.code} : </span>
          <span className="font-bold">{project.code}</span>
        </p>
      )}
      <TextField id={ID.name} label={p.name} required value={form.name} error={errors.name} onChange={(e) => set("name", e.target.value)} />
      <div className="flex flex-col gap-5">
        <div className="grid gap-20 sm:grid-cols-2">
          <TextField id={ID.start} label={p.start} required inputMode="numeric" value={form.start} error={errors.start} aria-describedby="p-format" onChange={(e) => set("start", e.target.value)} />
          <TextField id={ID.end} label={p.end} inputMode="numeric" value={form.end} error={errors.end} aria-describedby="p-format" onChange={(e) => set("end", e.target.value)} />
        </div>
        <p className="text-sm text-gray-595" id="p-format">
          {p.dateFormat}
        </p>
      </div>
      <SelectField label={p.status} hint={p.statusHint} value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
        {PROJECT_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {statusLook("project", s).label}
          </option>
        ))}
      </SelectField>
      <div>
        <label className="mb-5 block font-bold" htmlFor={ID.budget}>
          {p.budget}
        </label>
        <InputGroup className="max-w-budget">
          <input
            id={ID.budget}
            className="min-h-control rounded-l-md border-2 border-black bg-white px-10"
            inputMode="numeric"
            aria-invalid={errors.budget ? true : undefined}
            aria-describedby={errors.budget ? `${ID.budget}-erreur` : undefined}
            value={form.budget}
            onChange={(e) => set("budget", e.target.value)}
          />
          <InputGroupText>jours</InputGroupText>
        </InputGroup>
        {errors.budget && <FieldError id={`${ID.budget}-erreur`}>{errors.budget}</FieldError>}
      </div>
      <div className="flex flex-col gap-10">
        <label className="font-bold" htmlFor={ID.activities}>
          {p.activities}
        </label>
        {form.activities.length > 0 && (
          <div className="flex flex-wrap gap-5">
            {form.activities.map((a) => (
              <Tag key={a} removeLabel={t(p.removeActivity, { name: a })} onRemove={() => set("activities", form.activities.filter((x) => x !== a))}>
                {a}
              </Tag>
            ))}
          </div>
        )}
        <InputGroup>
          <input
            id={ID.activities}
            className="min-h-control rounded-l-md border-2 border-black bg-white px-10"
            placeholder={p.newActivity}
            aria-invalid={errors.activities || errors.activity ? true : undefined}
            aria-describedby={[errors.activities || errors.activity ? `${ID.activities}-erreur` : "", errors.activityInUse ? "p-activite-usage" : ""].join(" ").trim() || undefined}
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addActivity();
              }
            }}
          />
          <Button onClick={addActivity}>{p.addActivity}</Button>
        </InputGroup>
        {(errors.activities ?? errors.activity) && <FieldError id={`${ID.activities}-erreur`}>{errors.activities ?? errors.activity}</FieldError>}
        {errors.activityInUse && <FieldError id="p-activite-usage">{errors.activityInUse}</FieldError>}
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col gap-10 border-0 p-0">
        <legend className="mb-10 p-0 font-bold">{t(p.members, { n: inTeam, total: team.length })}</legend>
        {team.map((u) => (
          <Checkbox
            key={u.id}
            label={u.name}
            checked={form.memberIds.includes(u.id)}
            onChange={(e) => set("memberIds", e.target.checked ? [...form.memberIds, u.id] : form.memberIds.filter((m) => m !== u.id))}
          />
        ))}
      </fieldset>
    </Offcanvas>
  );
}
