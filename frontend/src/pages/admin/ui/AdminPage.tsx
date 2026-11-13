// Écran 12 : administration de la division (PROMPT.md §9.9, planche 12-Admin-division).
// Une page à ancres : Utilisateurs, Rôles et permissions, Workflows, Règles de saisie, Jours fériés.
// Chaque bloc s'enregistre seul ; une saisie non enregistrée reste à l'écran en cas d'échec.
// Un seul bouton primaire : « Inviter un utilisateur ».
import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { adminMessage, fieldMessages, ruleOf, useAdmin, useSaveMatrix, useSaveRules, useSaveWorkflow, type Admin, type Matrix, type Rules, type Workflow } from "@/entities/admin";
import { focusFirstRule, MatrixTable, RulesFields, WorkflowFields, type FieldErrors } from "@/features/division-settings";
import { dict, t } from "@/shared/i18n";
import { Button } from "@/shared/ui/Button";
import { Alert, Placeholder } from "@/shared/ui/Display";
import { AnchorNav } from "@/shared/ui/Navigation";
import { HolidaysSection } from "./HolidaysSection";
import { UsersSection } from "./UsersSection";

const a = dict.admin;

type Notice = { tone: "success" | "danger"; text: string } | null;

function Result({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  if (!notice) return null;
  return (
    <Alert tone={notice.tone} role={notice.tone === "danger" ? "alert" : "status"} onClose={onClose}>
      <p>{notice.text}</p>
    </Alert>
  );
}

function PermissionsSection({ initial }: { initial: Matrix }) {
  const save = useSaveMatrix();
  const [matrix, setMatrix] = useState(initial);
  const [notice, setNotice] = useState<Notice>(null);

  return (
    <section id="permissions" aria-labelledby="titre-permissions" className="flex scroll-mt-20 flex-col gap-20">
      <h2 id="titre-permissions">{a.permissionsTitle}</h2>
      <p>{a.permissionsIntro}</p>
      <MatrixTable
        matrix={matrix}
        onChange={(m) => {
          setNotice(null);
          setMatrix(m);
        }}
      />
      <div className="flex justify-end">
        <Button
          disabled={save.isPending}
          onClick={() => {
            setNotice(null);
            save.mutate(matrix, {
              onSuccess: () => setNotice({ tone: "success", text: a.permissionsSaved }),
              onError: (e) => setNotice({ tone: "danger", text: adminMessage(ruleOf(e).code) }),
            });
          }}
        >
          {a.savePermissions}
        </Button>
      </div>
      <Result notice={notice} onClose={() => setNotice(null)} />
    </section>
  );
}

function WorkflowSection({ initial }: { initial: Workflow }) {
  const save = useSaveWorkflow();
  const [w, setW] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    save.mutate(w, {
      onSuccess: () => {
        setErrors({});
        setNotice({ tone: "success", text: a.workflowSaved });
      },
      onError: (err) => {
        const rule = ruleOf(err);
        if (rule.fields.length > 0) {
          setErrors(fieldMessages(rule.fields));
          document.getElementById("relance")?.focus();
        } else setNotice({ tone: "danger", text: adminMessage(rule.code) });
      },
    });
  }

  return (
    <section id="workflows" aria-labelledby="titre-workflows" className="flex scroll-mt-20 flex-col gap-20">
      <h2 id="titre-workflows">{a.workflowTitle}</h2>
      <form className="flex flex-col gap-20" onSubmit={onSubmit} noValidate>
        <WorkflowFields
          value={w}
          errors={errors}
          onChange={(patch) => {
            setNotice(null);
            setW((x) => ({ ...x, ...patch }));
          }}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {a.saveWorkflow}
          </Button>
        </div>
        <Result notice={notice} onClose={() => setNotice(null)} />
      </form>
    </section>
  );
}

function RulesSection({ initial }: { initial: Rules }) {
  const save = useSaveRules();
  const [saved, setSaved] = useState(initial);
  const [r, setR] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const dirty = JSON.stringify(r) !== JSON.stringify(saved);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    save.mutate(r, {
      onSuccess: () => {
        setSaved(r);
        setErrors({});
        setNotice({ tone: "success", text: a.rulesSaved });
      },
      onError: (err) => {
        const rule = ruleOf(err);
        if (rule.fields.length > 0) {
          const messages = fieldMessages(rule.fields);
          setErrors(messages);
          focusFirstRule(messages);
        } else setNotice({ tone: "danger", text: adminMessage(rule.code) });
      },
    });
  }

  return (
    <section id="regles" aria-labelledby="titre-regles" className="flex scroll-mt-20 flex-col gap-20">
      <h2 id="titre-regles">{a.rulesTitle}</h2>
      <form className="flex flex-col gap-20" onSubmit={onSubmit} noValidate>
        <RulesFields
          value={r}
          errors={errors}
          onChange={(patch) => {
            setNotice(null);
            setR((x) => ({ ...x, ...patch }));
          }}
        />
        <div className="flex flex-wrap justify-end gap-10">
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => {
              setR(saved);
              setErrors({});
              setNotice(null);
            }}
          >
            {a.cancel}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {a.saveRules}
          </Button>
        </div>
        <Result notice={notice} onClose={() => setNotice(null)} />
      </form>
    </section>
  );
}

function Loaded({ admin }: { admin: Admin }) {
  const location = useLocation();
  // Ancre de l'adresse (/administration#regles) : le contenu arrive après le chargement.
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);

  return (
    <main className="flex flex-col gap-60">
      <div className="flex flex-col gap-20">
        <div className="flex flex-col gap-10">
          <h1>{a.title}</h1>
          <p className="text-gray-595">{t(a.intro, { division: admin.divisionName })}</p>
        </div>
        <AnchorNav
          label={a.onThisPage}
          items={[
            { id: "utilisateurs", label: a.usersTitle },
            { id: "permissions", label: a.permissionsTitle },
            { id: "workflows", label: a.workflowTitle },
            { id: "regles", label: a.rulesTitle },
            { id: "jours-feries", label: a.holidays.title },
          ]}
        />
      </div>
      <UsersSection admin={admin} />
      <PermissionsSection initial={admin.matrix} />
      <WorkflowSection initial={admin.workflow} />
      <RulesSection initial={admin.rules} />
      <HolidaysSection />
    </main>
  );
}

export function AdminPage() {
  const query = useAdmin();
  if (query.isPending) {
    return (
      <main className="flex flex-col gap-30" aria-busy="true">
        <h1>{a.title}</h1>
        <p className="sr-only" role="status">
          {a.loading}
        </p>
        <Placeholder className="h-control w-full" />
        <Placeholder className="h-pad w-full" />
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="flex flex-col gap-30">
        <h1>{a.title}</h1>
        <Alert tone="danger" role="alert" heading={a.errorTitle} action={<Button onClick={() => void query.refetch()}>{dict.form.retry}</Button>}>
          <p>{a.errorText}</p>
        </Alert>
      </main>
    );
  }
  // Les blocs gardent leur saisie : ils ne repartent pas des données relues après un enregistrement.
  return <Loaded admin={query.data} />;
}
