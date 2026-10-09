"use client";
// Administration de division, bloc Utilisateurs (PROMPT.md §9.9, planche 12). Rôle et
// compte changent tout de suite, avec « Annuler » ; invitation et modification dans une
// modale (non maquettée, §19).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { resendUserInvitation, saveUserForm, setUserActive, setUserRole, type AdminError } from "@/app/actions/admin";
import { Button } from "@/components/ods/Button";
import { Alert, Badge } from "@/components/ods/Display";
import { RequiredLegend, SelectField, Switch, TextField } from "@/components/ods/Form";
import { Pagination } from "@/components/ods/Navigation";
import { Modal } from "@/components/ods/Overlay";
import { EmptyState } from "@/components/ts/States";
import type { UserErrors } from "@/lib/admin/rules";
import { dict, t } from "@/lib/i18n";
import type { DivisionRole } from "@/lib/permissions";

const a = dict.admin;

export type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: DivisionRole;
  managerId: string | null;
  manager: string | null;
  active: boolean;
  invited: boolean;
  isSelf: boolean;
};

export type UsersView = {
  rows: UserRow[];
  total: number;
  from: number;
  to: number;
  page: number;
  count: number;
  query: string;
  managers: Array<{ id: string; name: string }>;
  roles: Array<{ value: DivisionRole; label: string }>;
};

type Notice = { tone: "success" | "danger"; text: string; undo?: () => void } | null;
type Form = { firstName: string; lastName: string; email: string; role: DivisionRole; managerId: string };

const errorText = (code: AdminError) => a.errors[code];

function UserModal({ view, editing, onClose, onDone }: { view: UsersView; editing: UserRow | null; onClose: () => void; onDone: (text: string) => void }) {
  const [form, setForm] = useState<Form>(() =>
    editing
      ? { firstName: editing.firstName, lastName: editing.lastName, email: editing.email, role: editing.role, managerId: editing.managerId ?? "" }
      : { firstName: "", lastName: "", email: "", role: "STAFF", managerId: "" },
  );
  const [errors, setErrors] = useState<UserErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const order = ["firstName", "lastName", "email", "role", "manager"] as const;
  const ids: Record<(typeof order)[number], string> = { firstName: "utilisateur-prenom", lastName: "utilisateur-nom", email: "utilisateur-email", role: "utilisateur-role", manager: "utilisateur-manager" };
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFailure(null);
    start(async () => {
      const r = await saveUserForm(editing?.id ?? null, { ...form, managerId: form.managerId || null });
      if (r.ok) {
        onDone(editing ? t(a.userSaved, { name: r.name }) : t(a.invitedNotice, { email: r.email ?? form.email }));
        return;
      }
      if ("fields" in r) {
        setErrors(r.fields);
        const first = order.find((k) => r.fields[k]);
        if (first) document.getElementById(ids[first])?.focus();
        return;
      }
      setFailure(errorText(r.error));
    });
  }

  function resend() {
    if (!editing) return;
    setFailure(null);
    start(async () => {
      const r = await resendUserInvitation(editing.id);
      if (r.ok) onDone(t(a.invitedNotice, { email: r.email }));
      else setFailure(errorText(r.error));
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t(a.userModalEdit, { name: editing.name }) : a.invite}
    >
      <form className="ts-section" onSubmit={onSubmit} noValidate>
        <RequiredLegend />
        {!editing && <p>{a.inviteHint}</p>}
        <TextField id={ids.firstName} label={a.firstName} required autoComplete="off" value={form.firstName} error={errors.firstName} onChange={(e) => set({ firstName: e.target.value })} />
        <TextField id={ids.lastName} label={a.lastName} required autoComplete="off" value={form.lastName} error={errors.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        <TextField
          id={ids.email}
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
        <SelectField id={ids.role} label={a.role} required value={form.role} error={errors.role} disabled={editing?.isSelf} onChange={(e) => set({ role: e.target.value as DivisionRole })}>
          {view.roles.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </SelectField>
        <SelectField id={ids.manager} label={a.manager} value={form.managerId} error={errors.manager} onChange={(e) => set({ managerId: e.target.value })}>
          <option value="">{a.managerNone}</option>
          {view.managers.filter((m) => m.id !== editing?.id).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </SelectField>
        {failure && <Alert tone="danger" role="alert"><p>{failure}</p></Alert>}
        <div className="ts-actions">
          {editing?.invited && (
            <button className="btn" type="button" onClick={resend} disabled={pending} style={{ marginRight: "auto" }}>
              {a.resendInvite}
            </button>
          )}
          <button className="btn" type="button" onClick={onClose}>{dict.form.cancel}</button>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {editing ? a.saveUser : a.sendInvite}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersSection({ view }: { view: UsersView }) {
  const router = useRouter();
  const [rows, setRows] = useState(view.rows);
  const [notice, setNotice] = useState<Notice>(null);
  const [modal, setModal] = useState<{ editing: UserRow | null } | null>(null);
  const [query, setQuery] = useState(view.query);
  const roleName = (r: DivisionRole) => view.roles.find((x) => x.value === r)?.label ?? r;

  // Les lignes suivent la page reçue du serveur (recherche, pagination, rafraîchissement).
  const [source, setSource] = useState(view.rows);
  if (source !== view.rows) {
    setSource(view.rows);
    setRows(view.rows);
  }

  const patch = (id: string, p: Partial<UserRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function changeRole(row: UserRow, next: DivisionRole, undo = true) {
    patch(row.id, { role: next });
    const r = await setUserRole(row.id, next);
    if (!r.ok) {
      patch(row.id, { role: row.role });
      setNotice({ tone: "danger", text: errorText(r.error) });
      return;
    }
    setNotice(undo ? { tone: "success", text: t(a.roleChanged, { name: r.name, role: roleName(next) }), undo: () => void changeRole({ ...row, role: next }, r.previous, false) } : { tone: "success", text: a.undone });
  }

  async function changeActive(row: UserRow, active: boolean, undo = true) {
    patch(row.id, { active });
    const r = await setUserActive(row.id, active);
    if (!r.ok) {
      patch(row.id, { active: row.active });
      setNotice({ tone: "danger", text: errorText(r.error) });
      return;
    }
    setNotice(undo ? { tone: "success", text: t(active ? a.activated : a.deactivated, { name: r.name }), undo: () => void changeActive({ ...row, active }, !active, false) } : { tone: "success", text: a.undone });
  }

  const href = (n: number) => {
    const p = new URLSearchParams();
    if (view.query) p.set("recherche", view.query);
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    return `/administration${qs ? `?${qs}` : ""}#utilisateurs`;
  };

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query.trim()) p.set("recherche", query.trim());
    const qs = p.toString();
    router.push(`/administration${qs ? `?${qs}` : ""}#utilisateurs`, { scroll: false });
  }

  return (
    <section id="utilisateurs" aria-labelledby="titre-utilisateurs" className="ts-section">
      <div className="ts-head">
        <h2 id="titre-utilisateurs">{a.usersTitle}</h2>
        <Button variant="primary" icon="plus" onClick={() => { setNotice(null); setModal({ editing: null }); }}>
          {a.invite}
        </Button>
      </div>

      <form role="search" onSubmit={onSearch} style={{ maxWidth: 420 }}>
        <label className="form-label" htmlFor="recherche-utilisateur">{a.searchLabel}</label>
        <div className="input-group">
          <input id="recherche-utilisateur" className="form-control" type="search" placeholder={a.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn" type="submit">{a.search}</button>
        </div>
      </form>

      {notice && (
        <Alert
          tone={notice.tone}
          role={notice.tone === "danger" ? "alert" : "status"}
          action={notice.undo ? <button className="btn btn-link" type="button" onClick={() => { const u = notice.undo; setNotice(null); u?.(); }}>{dict.form.undo}</button> : undefined}
        >
          <p>{notice.text}</p>
        </Alert>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title={a.noUser}
          actions={<Link className="btn" href="/administration#utilisateurs" onClick={() => setQuery("")}>{a.showAll}</Link>}
        >
          {a.noUserHint}
        </EmptyState>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table">
              <caption className="visually-hidden">{a.usersCaption}</caption>
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
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">
                      {r.name}
                      <span className="ts-user-email">{r.email}</span>
                      {r.invited && <Badge>{a.invited}</Badge>}
                    </th>
                    <td>
                      <select
                        className="form-select form-control-sm"
                        aria-label={t(a.roleOf, { name: r.name })}
                        value={r.role}
                        disabled={!r.active || r.isSelf}
                        onChange={(e) => void changeRole(r, e.target.value as DivisionRole)}
                        style={{ minWidth: 160 }}
                      >
                        {view.roles.map((x) => (
                          <option key={x.value} value={x.value}>{x.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>{r.manager ?? a.noManager}</td>
                    <td>
                      <Switch label={t(a.accountOf, { name: r.name })} checked={r.active} disabled={r.isSelf} onChange={(e) => void changeActive(r, e.target.checked)} />
                    </td>
                    <td>
                      <button className="btn btn-link" type="button" aria-label={t(a.editLabel, { name: r.name })} onClick={() => { setNotice(null); setModal({ editing: r }); }}>
                        {a.edit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ts-head">
            <p className="small">{t(a.usersRange, { from: view.from, to: view.to, total: view.total })}</p>
            <Pagination page={view.page} pageCount={view.count} href={href} label={a.usersPagination} />
          </div>
        </>
      )}

      {modal && (
        <UserModal
          view={view}
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
