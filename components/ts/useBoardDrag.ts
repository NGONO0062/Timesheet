"use client";
// Glisser-déposer des tableaux en colonnes (Tâches §9.12, Projets en colonnes §9.4).
// À la souris seulement : chaque tableau garde le même déplacement par l'étiquette de
// la carte, au clavier et au doigt (WCAG 2.2, critère 2.5.7).
import { useState, type DragEvent } from "react";

export function useBoardDrag<C extends string>(enabled: boolean, onDrop: (id: string, column: C) => void) {
  const [over, setOver] = useState<C | null>(null);

  /** Propriétés d'une colonne : elle accepte la carte et s'encadre pendant le survol. */
  const column = (c: C) =>
    enabled
      ? {
          onDragOver: (e: DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (over !== c) setOver(c);
          },
          onDragLeave: (e: DragEvent<HTMLElement>) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
          },
          onDrop: (e: DragEvent) => {
            e.preventDefault();
            setOver(null);
            const id = e.dataTransfer.getData("text/plain");
            if (id) onDrop(id, c);
          },
        }
      : {};

  /** Propriétés d'une carte : elle porte son identifiant (`can` à faux pendant une édition). */
  const card = (id: string, can = true) =>
    enabled && can
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.setData("text/plain", id);
            e.dataTransfer.effectAllowed = "move";
          },
          onDragEnd: () => setOver(null),
        }
      : { draggable: false };

  return { over, column, card };
}
