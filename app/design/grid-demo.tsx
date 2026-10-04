"use client";
// Données de démonstration des planches C2 (semaine 12 de 2026).
import { useState } from "react";
import { TimeGrid, type GridRow } from "@/components/ts/TimeGrid";
import { utcDate } from "@/lib/iso-week";
import { expectedPerDay, parseHours, dayTotals, submitCheck } from "@/lib/timesheet/rules";

export const DAYS = [16, 17, 18, 19, 20].map((d) => utcDate(2026, 3, d));
export const EXPECTED = expectedPerDay(DAYS, 8);
export const STEP = 0.5;

export const row = (id: string, project: string, activity: string, values: string[], flagged?: boolean[]): GridRow => ({
  id, project, activity, values, flagged,
});

export function useGrid(initial: GridRow[]) {
  const [rows, setRows] = useState(initial);
  const numbers = rows.map((r) => DAYS.map((_, j) => {
    const p = parseHours(r.values[j] ?? "", STEP);
    return p.kind === "ok" ? p.value : 0;
  }));
  const check = submitCheck(DAYS, dayTotals(numbers, DAYS.length), EXPECTED);
  return {
    rows,
    check,
    onChange: (id: string, j: number, raw: string) =>
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, values: r.values.map((v, k) => (k === j ? raw : v)) } : r))),
    onRemove: (id: string) => setRows((rs) => rs.filter((r) => r.id !== id)),
  };
}

export function LiveGrid({ caption, initial }: { caption: string; initial: GridRow[] }) {
  const g = useGrid(initial);
  return <TimeGrid caption={caption} days={DAYS} expected={EXPECTED} rows={g.rows} step={STEP} onChange={g.onChange} onRemove={g.onRemove} />;
}
