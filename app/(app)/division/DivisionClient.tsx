"use client";
// Parties interactives de la vue consolidée : sélecteur de semaine (dans l'URL),
// relances des dérives et Réessayer d'un bloc en erreur.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { remindManagerAction, remindPersonAction, type RemindResult } from "@/app/actions/division";
import { Alert } from "@/components/ods/Display";
import { Mark } from "@/components/ods/Icon";
import { WeekSelector, type RecentWeek } from "@/components/ts/WeekSelector";
import { dict, t } from "@/lib/i18n";
import { compareWeeks, type IsoWeek } from "@/lib/iso-week";

const d = dict.division;

export function DivisionWeekNav(props: { week: IsoWeek; current: IsoWeek; recent: RecentWeek[] }) {
  const router = useRouter();
  return (
    <WeekSelector
      {...props}
      allowFutureWeeks={false}
      nextDisabledLabel={d.nextDisabled}
      onNavigate={(w) => router.push(compareWeeks(w, props.current) === 0 ? "/division" : `/division?annee=${w.year}&semaine=${w.week}`, { scroll: false })}
    />
  );
}

/** Relance par e-mail d'une dérive : le résultat s'écrit sous le bouton, dans une zone de statut. */
export function RemindButton({ label, ariaLabel, target }: {
  label: string;
  ariaLabel: string;
  target: { kind: "manager"; managerId: string } | { kind: "person"; personId: string; week: IsoWeek };
}) {
  const [result, setResult] = useState<RemindResult | null>(null);
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      setResult(
        target.kind === "manager"
          ? await remindManagerAction(target.managerId)
          : await remindPersonAction(target.personId, { year: target.week.year, week: target.week.week }),
      );
    });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
      {result?.ok ? null : (
        <button className="btn btn-link" type="button" aria-label={ariaLabel} onClick={send} disabled={pending}>
          {label}
        </button>
      )}
      <span className="small" role="status" style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {result && <Mark tone={result.ok ? "success" : "danger"} />}
        {result?.ok && t(d.reminded, { name: result.name })}
        {result && !result.ok && (result.error === "nothingLate" ? d.nothingToRemind : d.remindFailed)}
      </span>
    </div>
  );
}

/** Un bloc en panne : il le dit, garde le reste de la page et propose Réessayer. */
export function BlockError() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Alert tone="danger" role="alert">
      <p>{d.blockError}</p>
      <div>
        <button className="btn" type="button" disabled={pending} onClick={() => start(() => router.refresh())}>
          {dict.form.retry}
        </button>
      </div>
    </Alert>
  );
}
