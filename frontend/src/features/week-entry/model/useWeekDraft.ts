// Saisie en cours d'une semaine : choix par jour et commentaire gardés à l'écran,
// brouillon enregistré automatiquement 800 ms après la dernière modification.
import { useEffect, useRef, useState } from "react";
import { ruleCodeOf, useSaveDraft, type DayValue, type Week, type WeekInput } from "@/entities/timesheet";
import { formatTime } from "@/shared/lib/format";
import type { SaveState } from "@/shared/ui/States";

const DELAY_MS = 800;

export type DraftSave = { state: SaveState; time?: string; message?: string };

export function useWeekDraft(week: Week) {
  const [values, setValues] = useState<DayValue[]>(() => week.days.map((d) => d.value));
  const [comment, setComment] = useState(week.comment ?? "");
  // Fiche rejetée et rien de modifié depuis : « Fiche rouverte à la saisie » plutôt que l'heure de la soumission.
  const untouchedSinceRejection = week.status === "REJECTED" && week.decision !== null && week.savedAt !== null && new Date(week.savedAt) <= new Date(week.decision.at);
  const [save, setSave] = useState<DraftSave>(week.savedAt && !untouchedSinceRejection ? { state: "saved", time: formatTime(new Date(week.savedAt)) } : { state: "idle" });
  const saveDraft = useSaveDraft(week);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<WeekInput | null>(null);

  const input = (v: DayValue[], c: string): WeekInput => ({ days: week.days.filter((d) => d.expected > 0).map((d) => ({ date: d.date, key: v[week.days.indexOf(d)] ?? null })), comment: c });

  function persist() {
    const next = latest.current;
    if (!next) return;
    latest.current = null;
    setSave({ state: "saving" });
    saveDraft.mutate(next, {
      onSuccess: (r) => setSave(r.savedAt ? { state: "saved", time: formatTime(new Date(r.savedAt)) } : { state: "idle" }),
      onError: (e) => setSave({ state: "failed", message: ruleCodeOf(e) }),
    });
  }

  function schedule(v: DayValue[], c: string) {
    latest.current = input(v, c);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, DELAY_MS);
  }

  // Changement de page : ce qui reste à enregistrer part tout de suite.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current) saveDraft.mutate(latest.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    values,
    comment,
    save,
    setDay(day: number, value: DayValue) {
      const next = values.map((v, k) => (k === day ? value : v));
      setValues(next);
      schedule(next, comment);
    },
    /** Plusieurs jours d'un coup (reprise d'une semaine, remplissage, « Annuler ») : un seul enregistrement. */
    setAll(next: DayValue[]) {
      setValues(next);
      schedule(next, comment);
    },
    setComment(next: string) {
      setComment(next);
      schedule(values, next);
    },
    /** Saisie actuelle, pour la soumission (qui l'enregistre elle-même). */
    current(): WeekInput {
      if (timer.current) clearTimeout(timer.current);
      latest.current = null;
      return input(values, comment);
    },
  };
}
