"use client";
// Suspension ou réactivation d'une division (non maquetté) : action réversible, tout de
// suite, avec un message qui propose « Annuler ».
import { useState, useTransition } from "react";
import { setDivisionState } from "@/app/actions/platform";
import { Alert } from "@/components/ods/Display";
import { dict, t } from "@/lib/i18n";

const p = dict.platform;

type Notice = { tone: "success" | "danger"; text: string; undo?: () => void } | null;

export function DivisionState({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) {
  const [current, setCurrent] = useState(status);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();

  function change(next: "ACTIVE" | "SUSPENDED", undoable = true) {
    setNotice(null);
    start(async () => {
      const r = await setDivisionState(id, next);
      if (!r.ok) {
        setNotice({ tone: "danger", text: r.error });
        return;
      }
      setCurrent(next);
      setNotice(
        undoable
          ? { tone: "success", text: t(next === "SUSPENDED" ? p.suspended : p.activated, { name: r.name }), undo: () => change(r.previous, false) }
          : { tone: "success", text: p.undone },
      );
    });
  }

  return (
    <div className="ts-section">
      <p>{p.manageIntro}</p>
      <div>
        <button className="btn" type="button" disabled={pending} onClick={() => change(current === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}>
          {current === "ACTIVE" ? p.suspend : p.activate}
        </button>
      </div>
      {notice && (
        <Alert
          tone={notice.tone}
          role={notice.tone === "danger" ? "alert" : "status"}
          action={notice.undo ? <button className="btn btn-link" type="button" onClick={() => { const u = notice.undo; setNotice(null); u?.(); }}>{dict.form.undo}</button> : undefined}
        >
          <p>{notice.text}</p>
        </Alert>
      )}
    </div>
  );
}
