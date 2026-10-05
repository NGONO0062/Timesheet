"use client";
// Sélecteur de semaine de la carte « Semaine en cours » : la semaine choisie passe dans l'URL.
import { useRouter } from "next/navigation";
import { WeekSelector, type RecentWeek } from "@/components/ts/WeekSelector";
import { compareWeeks, type IsoWeek } from "@/lib/iso-week";

export function WeekNav(props: { week: IsoWeek; current: IsoWeek; allowFutureWeeks: boolean; recent: RecentWeek[]; large?: boolean }) {
  const router = useRouter();
  return (
    <WeekSelector
      {...props}
      onNavigate={(w) =>
        router.push(compareWeeks(w, props.current) === 0 ? "/tableau-de-bord" : `/tableau-de-bord?annee=${w.year}&semaine=${w.week}`, { scroll: false })
      }
    />
  );
}
