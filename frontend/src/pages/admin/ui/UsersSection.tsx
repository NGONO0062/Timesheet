// Administration de division, bloc Utilisateurs (PROMPT.md §9.9, planche 12). Rôle et
// compte changent tout de suite, avec « Annuler » ; invitation et modification dans une
// fenêtre (non maquettée, §19). Recherche et page dans l'adresse.
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import {
  adminMessage,
  DIVISION_ROLES,
  fieldMessages,
  ruleOf,
  useAdminUsers,
  useChangeRole,
  useResendInvitation,
  useSaveUser,
  useSetActive,
  type Admin,
  type AdminUser,
  type DivisionRole,
} from "@/entities/admin";
import { roleLabel } from "@/entities/viewer";
import { dict, t } from "@/shared/i18n";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Alert, Badge, Placeholder, Table } from "@/shared/ui/Display";
import { InputGroup, RequiredLegend, SelectField, Switch, TextField } from "@/shared/ui/Form";
import { Pagination } from "@/shared/ui/Navigation";
import { Modal } from "@/shared/ui/Overlay";
import { EmptyState } from "@/shared/ui/States";
import { CONTROL } from "@/shared/ui/Form";
import { cx } from "@/shared/lib/cx";

const a = dict.admin;

type Notice = { tone: "success" | "danger"; text: string; undo?: () => void } | null;

type Form = { firstName: string; lastName: string; email: string; role: DivisionRole; managerId: string };

const IDS: Record<string, string> = {
  firstName: "utilisateur-prenom",
  lastName: "utilisateur-nom",
  email: "utilisateur-email",
  role: "utilisateur-role",
  manager: "utilisateur-manager",
};
const ORDER = ["firstName", "lastName", "email", "role", "manager"];

function UserModal({ managers, editing, onClose, onDone }: { managers: Admin["managers"]; editing: AdminUser | null; onClose: () => void; onDone: (text: string) => void }) {
  const save = useSaveUser();
  const resend = useResendInvitation();
  const [form, setForm] = useState<Form>(() =>
    editing
      ? {
          firstName: editing.firstName,
          lastName: editing.lastName,
          email: editing.email,
          role: editing.role,
          managerId: editing.managerId ?? "",
        }
      : { firstName: "", lastName: "", email: "", role: "STAFF", managerId: "" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFailure(null);
    const user = { email: form.email, firstName: form.firstName, lastName: form.lastName, role: form.role, managerId: form.managerId || null };
    save.mutate(
      { id: editing?.id ?? null, user },
      {
        onSuccess: (r) => onDone(editing ? t(a.userSaved, { name: r.name }) : t(a.invitedNotice, { email: r.email })),
        onError: (err) => {
          const rule = ruleOf(err);
          if (rule.fields.length > 0) {
            const messages = fieldMessages(rule.fields);
            setErrors(messages);
            const first = ORDER.find((k) => messages[k] || (k === "email" && rule.fields.includes("emailTaken")));
            if (first) document.getElementById(IDS[first] ?? "")?.focus();
            return;
          }
          setFailure(adminMessage(rule.code));
        },
      },
    );
  }

  function onResend() {
    if (!editing) return;
    setFailure(null);
    resend.mutate(editing.id, { onSuccess: (r) => onDone(t(a.invitedNotice, { email: r.email })), onError: (err) => setFailure(adminMessage(ruleOf(err).code)) });
  }

  const pending = save.isPending || resend.isPending;
  return (
    <Modal open onClose={onClose} title={editing ? t(a.userModalEdit, { name: editing.name }) : a.invite}>
      <form className="flex flex-col gap-20" onSubmit={onSubmit} noValidate>
        <RequiredLegend />
        {!editing && <p>{a.inviteHint}</p>}
        <TextField id={IDS.firstName} label={a.firstName} required autoComplete="off" value={form.firstName} error={errors.firstName} onChange={(e) => set({ firstName: e.target.value })} />
        <TextField id={IDS.lastName} label={a.lastName} required autoComplete="off" value={form.lastName} error={errors.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        <TextField
          id={IDS.email}
          label={a.email}
          type="email"
          required
          autoComplete="off"
          disabled={Boolean(editing)}
          hint={editing ? a.emailFixed : undefined}
          value={form.email}
          error={errors.email}
          onChange={(e) => set({ email: e.target.value })}
        />
        <SelectField id={IDS.role} label={a.role} required value={form.role} error={errors.role} disabled={editing?.isSelf} onChange={(e) => set({ role: e.target.value as DivisionRole })}>
          {DIVISION_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </SelectField>
        <SelectField id={IDS.manager} label={a.manager} value={form.managerId} error={errors.manager} onChange={(e) => set({ managerId: e.target.value })}>
          <option value="">{a.managerNone}</option>
          {managers
            .filter((m) => m.id !== editing?.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </SelectField>
        {failure && (
          <Alert tone="danger" role="alert" onClose={() => setFailure(null)}>
            <p>{failure}</p>
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-10">
          {editing?.invited && (
            <Button className="mr-auto" onClick={onResend} disabled={pending}>
              {a.resendInvite}
            </Button>
          )}
          <Button onClick={onClose}>{dict.form.cancel}</Button>
          <Button variant="primary" type="submit" disabled={pending}>
            {editing ? a.saveUser : a.sendInvite}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersSection({ admin }: { admin: Admin }) {
  const [params, setParams] = useSearchParams();
  const query = params.get("recherche") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const users = useAdminUsers(query, page);
  const changeRole = useChangeRole();
  const setActive = useSetActive();
  const [search, setSearch] = useState(query);
  const [notice, setNotice] = useState<Notice>(null);
  const [modal, setModal] = useState<{ editing: AdminUser | null } | null>(null);

  const href = (n: number) => {
    const p = new URLSearchParams();
    if (query) p.set("recherche", query);
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    return `/administration${qs ? `?${qs}` : ""}#utilisateurs`;
  };

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const next = new URLSearchParams();
    if (search.trim()) next.set("recherche", search.trim());
    setParams(next);
  }

  // La ligne montre la nouvelle valeur dès le clic, jusqu'à la liste relue (ou l'échec).
  const [local, setLocal] = useState<Record<string, { role?: DivisionRole; active?: boolean }>>({});
  const patch = (id: string, value: { role?: DivisionRole; active?: boolean } | null) =>
    setLocal((l) => (value ? { ...l, [id]: { ...l[id], ...value } } : Object.fromEntries(Object.entries(l).filter(([k]) => k !== id))));

  function role(row: AdminUser, next: DivisionRole, undoable = true) {
    patch(row.id, { role: next });
    changeRole.mutate(
      { id: row.id, role: next },
      {
        onSuccess: (r) =>
          setNotice(undoable ? { tone: "success", text: t(a.roleChanged, { name: r.name, role: roleLabel(next) }), undo: () => role({ ...row, role: next }, r.previous, false) } : { tone: "success", text: a.undone }),
        onError: (err) => setNotice({ tone: "danger", text: adminMessage(ruleOf(err).code) }),
        onSettled: () => patch(row.id, null),
      },
    );
  }

  function active(row: AdminUser, next: boolean, undoable = true) {
    patch(row.id, { active: next });
    setActive.mutate(
      { id: row.id, active: next },
      {
        onSuccess: (r) =>
          setNotice(undoable ? { tone: "success", text: t(next ? a.activated : a.deactivated, { name: r.name }), undo: () => active({ ...row, active: next }, !next, false) } : { tone: "success", text: a.undone }),
        onError: (err) => setNotice({ tone: "danger", text: adminMessage(ruleOf(err).code) }),
        onSettled: () => patch(row.id, null),
      },
    );
  }

  return (
    <section id="utilisateurs" aria-labelledby="titre-utilisateurs" className="flex scroll-mt-20 flex-col gap-20">
      <div className="flex flex-wrap items-center justify-between gap-20">
        <h2 id="titre-utilisateurs">{a.usersTitle}</h2>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => {
            setNotice(null);
            setModal({ editing: null });
          }}
        >
          {a.invite}
        </Button>
      </div>

      <form role="search" onSubmit={onSearch} className="max-w-form">
        <label className="mb-5 block font-bold" htmlFor="recherche-utilisateur">
          {a.searchLabel}
        </label>
        <InputGroup>
          <input id="recherche-utilisateur" className={cx(CONTROL, "h-control rounded-l-md")} type="search" placeholder={a.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit">{a.search}</Button>
        </InputGroup>
      </form>

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

      {users.isPending ? (
        <Placeholder className="h-pad w-full" />
      ) : users.isError ? (
        <Alert tone="danger" role="alert" heading={a.errorTitle} action={<Button onClick={() => void users.refetch()}>{dict.form.retry}</Button>}>
          <p>{a.errorText}</p>
        </Alert>
      ) : users.data.rows.length === 0 ? (
        <EmptyState
          title={a.noUser}
          actions={
            <Link className={buttonClass()} to="/administration#utilisateurs" onClick={() => setSearch("")}>
              {a.showAll}
            </Link>
          }
        >
          {a.noUserHint}
        </EmptyState>
      ) : (
        <>
          <Table caption={a.usersCaption}>
            <thead>
              <tr>
                <th scope="col">{a.colName}</th>
                <th scope="col">{a.colRole}</th>
                <th scope="col">{a.colManager}</th>
                <th scope="col">{a.colAccount}</th>
                <th scope="col">{a.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {users.data.rows.map((r) => {
                const shownRole = local[r.id]?.role ?? r.role;
                const shownActive = local[r.id]?.active ?? r.active;
                return (
                  <tr key={r.id}>
                    <th scope="row">
                      <span className="flex flex-col gap-5">
                        <span>{r.name}</span>
                        <span className="text-sm font-normal text-gray-595">{r.email}</span>
                        {r.invited && (
                          <span>
                            <Badge>{a.invited}</Badge>
                          </span>
                        )}
                      </span>
                    </th>
                    <td>
                      <SelectField
                        label={t(a.roleOf, { name: r.name })}
                        hideLabel
                        size="sm"
                        className="min-w-status-col"
                        value={shownRole}
                        disabled={!shownActive || r.isSelf}
                        onChange={(e) => role(r, e.target.value as DivisionRole)}
                      >
                        {DIVISION_ROLES.map((x) => (
                          <option key={x} value={x}>
                            {roleLabel(x)}
                          </option>
                        ))}
                      </SelectField>
                    </td>
                    <td>{r.manager ?? a.noManager}</td>
                    <td>
                      <Switch label={t(a.accountOf, { name: r.name })} checked={shownActive} disabled={r.isSelf} onChange={(e) => active(r, e.target.checked)} />
                    </td>
                    <td>
                      <Button
                        variant="link"
                        aria-label={t(a.editLabel, { name: r.name })}
                        onClick={() => {
                          setNotice(null);
                          setModal({ editing: r });
                        }}
                      >
                        {a.edit}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-20">
            <p className="text-sm">{t(a.usersRange, { from: users.data.from, to: users.data.to, total: users.data.total })}</p>
            <Pagination page={users.data.page} pageCount={users.data.count} href={href} label={a.usersPagination} />
          </div>
        </>
      )}

      {modal && (
        <UserModal
          managers={admin.managers}
          editing={modal.editing}
          onClose={() => setModal(null)}
          onDone={(text) => {
            setModal(null);
            setNotice({ tone: "success", text });
          }}
        />
      )}
    </section>
  );
}
