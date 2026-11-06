// Sélecteur de semaine (planche C1) : trois boutons accolés et un raccourci.
import { useEffect, useRef, useState } from "react";
import { cx } from "@/shared/lib/cx";
import { formatRange } from "@/shared/lib/format";
import { dict, t } from "@/shared/i18n";
import { addDays, compareWeeks, mondayOf, shiftWeek, type IsoWeek } from "@/shared/lib/iso-week";
import type { TimesheetStatus } from "@/shared/lib/status";
import { Badge } from "@/shared/ui/Display";
import { Button } from "@/shared/ui/Button";
import { Dropdown } from "@/shared/ui/Dropdown";
import { Icon } from "@/shared/ui/Icon";
import { StatusBadge } from "@/shared/ui/StatusBadge";

/** Semaine récente du menu ; sans statut sur les vues qui ne portent pas sur une fiche (vue division). */
export type RecentWeek = { week: IsoWeek; status?: TimesheetStatus };

type Props = {
  week: IsoWeek;
  current: IsoWeek;
  onNavigate: (week: IsoWeek) => void;
  /** La division interdit la saisie des semaines futures. */
  allowFutureWeeks: boolean;
  recent: RecentWeek[];
  olderHref?: string;
  /** Contrôles de 50 px, libellé sur deux lignes (mobile 375). */
  large?: boolean;
  /** Liste affichée : planches de /design seulement. */
  staticOpen?: boolean;
  /** Raison écrite sur la flèche « suivante » désactivée, si elle ne porte pas sur la saisie. */
  nextDisabledLabel?: string;
};

const rangeOf = (w: IsoWeek, withYear = true) => {
  const monday = mondayOf(w);
  return formatRange(monday, addDays(monday, 4), withYear);
};

const ARROW =
  "inline-flex flex-none cursor-pointer items-center justify-center border-2 border-black bg-white text-black hover:bg-black hover:text-white " +
  "active:border-active active:bg-active active:text-black disabled:cursor-not-allowed disabled:border-gray-999 disabled:bg-gray-999 disabled:text-white";

const LABEL =
  "inline-flex w-full cursor-pointer items-center justify-center border-y-2 border-black bg-white font-bold text-black " +
  "hover:bg-black hover:text-white data-open:bg-black data-open:text-white";

export function WeekSelector({ week, current, onNavigate, allowFutureWeeks, recent, olderHref, large, staticOpen, nextDisabledLabel }: Props) {
  const prev = shiftWeek(week, -1);
  const next = shiftWeek(week, 1);
  const isCurrent = compareWeeks(week, current) === 0;
  const nextBlocked = !allowFutureWeeks && compareWeeks(next, current) > 0;
  const range = rangeOf(week);

  // Le changement de semaine est annoncé par une zone de statut.
  const [announce, setAnnounce] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setAnnounce(t(dict.week.announce, { week: week.week, range }));
  }, [week.year, week.week, range]);

  const items = [
    ...(large && !isCurrent ? [{ key: "courante", content: <span>{dict.week.current}</span>, onSelect: () => onNavigate(current) }] : []),
    ...recent.map((r) => ({
      key: `${r.week.year}-${r.week.week}`,
      content: (
        <span className="flex w-full items-center justify-between gap-20">
          <span>{t(dict.week.labelWithRange, { week: r.week.week, range: rangeOf(r.week, false) })}</span>
          {r.status && <StatusBadge kind="timesheet" value={r.status} />}
        </span>
      ),
      current: compareWeeks(r.week, week) === 0,
      onSelect: () => onNavigate(r.week),
    })),
    ...(olderHref
      ? [{ key: "anciennes", content: <span className="flex w-full items-center justify-between gap-20">{dict.week.older}<Icon name="right" /></span>, href: olderHref }]
      : []),
  ];

  const box = large ? "size-control-lg" : "size-control";
  return (
    <div className="flex flex-wrap items-center gap-10" role="group" aria-label={dict.week.group}>
      <div className={cx("flex items-stretch", large && "w-full")}>
        <button className={cx(ARROW, box, "rounded-l-md")} type="button" aria-label={t(dict.week.previous, { week: prev.week })} onClick={() => onNavigate(prev)}>
          <Icon name="left" />
        </button>
        <div className={cx("flex", large ? "min-w-0 flex-1" : "min-w-week-label")}>
          <Dropdown
            label={dict.week.group}
            checkSide="start"
            staticOpen={staticOpen}
            className="w-full"
            // La liste part du bord de la flèche « précédente » : décalée de sa largeur.
            menuClassName={cx("w-week-menu max-w-screen", large ? "-ml-control-lg" : "-ml-control")}
            items={items}
            buttonClassName={cx(LABEL, large ? "min-h-control-lg flex-col px-10 py-5" : "min-h-control gap-10 px-btn-x py-btn-y")}
          >
            {large ? (
              <>
                <span>{t(dict.week.label, { week: week.week })}</span>
                <span className="text-sm font-normal">{range}</span>
              </>
            ) : (
              <>
                {t(dict.week.labelWithRange, { week: week.week, range })}
                <Icon name="down" />
              </>
            )}
          </Dropdown>
        </div>
        <button
          className={cx(ARROW, box, "rounded-r-md")}
          type="button"
          disabled={nextBlocked}
          aria-label={nextBlocked ? (nextDisabledLabel ?? dict.week.nextDisabled) : t(dict.week.next, { week: next.week })}
          onClick={() => onNavigate(next)}
        >
          <Icon name="right" />
        </button>
      </div>
      {!large &&
        (isCurrent ? (
          <Badge dark>{dict.week.current}</Badge>
        ) : (
          <Button onClick={() => onNavigate(current)}>{dict.week.current}</Button>
        ))}
      <p className="sr-only" role="status">
        {announce}
      </p>
    </div>
  );
}
