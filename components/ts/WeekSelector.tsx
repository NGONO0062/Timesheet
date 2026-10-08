"use client";
// Sélecteur de semaine (.ts-week, planche C1).
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@/components/ods/Dropdown";
import { Icon } from "@/components/ods/Icon";
import { cx } from "@/lib/cx";
import { formatRange } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { addDays, compareWeeks, mondayOf, shiftWeek, type IsoWeek } from "@/lib/iso-week";
import type { DisplayStatus } from "@/lib/timesheet/rules";
import { StatusBadge } from "./StatusBadge";

/** Semaine récente du menu ; sans statut sur les vues qui ne portent pas sur une fiche (vue division). */
export type RecentWeek = { week: IsoWeek; status?: DisplayStatus };

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
  defaultOpen?: boolean;
  /** Raison écrite sur la flèche « suivante » désactivée, si elle ne porte pas sur la saisie. */
  nextDisabledLabel?: string;
};

const rangeOf = (w: IsoWeek, withYear = true) => {
  const monday = mondayOf(w);
  return formatRange(monday, addDays(monday, 4), withYear);
};

export function WeekSelector({ week, current, onNavigate, allowFutureWeeks, recent, olderHref, large, defaultOpen, nextDisabledLabel }: Props) {
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
    ...(large && !isCurrent
      ? [{ key: "courante", content: <span>{dict.week.current}</span>, onSelect: () => onNavigate(current) }]
      : []),
    ...recent.map((r) => ({
      key: `${r.week.year}-${r.week.week}`,
      content: (
        <>
          <span>{t(dict.week.labelWithRange, { week: r.week.week, range: rangeOf(r.week, false) })}</span>
          {r.status && <StatusBadge kind="timesheet" value={r.status} />}
        </>
      ),
      current: compareWeeks(r.week, week) === 0,
      onSelect: () => onNavigate(r.week),
    })),
    ...(olderHref
      ? [{ key: "anciennes", content: (<><span>{dict.week.older}</span><Icon name="right" /></>), href: olderHref }]
      : []),
  ];

  return (
    <div className={cx("ts-week", large && "ts-week-lg")} role="group" aria-label={dict.week.group}>
      <div className="ts-week-nav">
        <button className="btn btn-icon" type="button" aria-label={t(dict.week.previous, { week: prev.week })} onClick={() => onNavigate(prev)}>
          <Icon name="left" />
        </button>
        <Dropdown
          label={dict.week.group}
          currentStyle="aria"
          defaultOpen={defaultOpen}
          menuStyle={{ width: 400, maxWidth: "calc(100vw - 40px)" }}
          items={items}
          trigger={(p) => (
            <button className="ts-week-label" type="button" {...p}>
              {large ? (
                <>
                  <span>{t(dict.week.label, { week: week.week })}</span>
                  <span className="small" style={{ fontWeight: 400 }}>{range}</span>
                </>
              ) : (
                <>
                  {t(dict.week.labelWithRange, { week: week.week, range })}
                  <Icon name="down" />
                </>
              )}
            </button>
          )}
        />
        <button
          className="btn btn-icon"
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
          <span className="badge bg-dark">{dict.week.current}</span>
        ) : (
          <button className="btn" type="button" onClick={() => onNavigate(current)}>
            {dict.week.current}
          </button>
        ))}
      <p className="visually-hidden" role="status">
        {announce}
      </p>
    </div>
  );
}
