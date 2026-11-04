// Suivi d'un projet DMAIC (PROMPT.md §9.4, lot 3) : phase, revue de passage, livrables
// types et indicateur. Non maquetté : mêmes composants et mêmes règles que l'écran 9.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFollowUp } from "@/lib/data/dmaic";
import { requirePermission, scopeOf } from "@/lib/data/viewer";
import { formatDate, zonedDay } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { DmaicFollowUp } from "./DmaicFollowUp";

export const metadata: Metadata = { title: dict.dmaic.title };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("MANAGE_PROJECTS");
  const { id } = await params;
  const f = await getFollowUp(scopeOf(viewer), id);
  if (!f) notFound();
  return (
    <DmaicFollowUp
      project={{
        ...f,
        tollgates: f.tollgates.map((g) => ({
          ...g,
          requestedAt: g.requestedAt.toISOString(),
          requestedOn: formatDate(zonedDay(g.requestedAt)),
          decidedAt: g.decidedAt?.toISOString() ?? null,
          decidedOn: g.decidedAt ? formatDate(zonedDay(g.decidedAt)) : null,
        })),
      }}
    />
  );
}
