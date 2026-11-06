import { describe, expect, it } from "vitest";
import { acceptsTimeEntry, statusChangedMessage } from "./rules";

describe("règles d'affichage des projets", () => {
  it("seul « En cours » ouvre la saisie", () => {
    expect(acceptsTimeEntry("IN_PROGRESS")).toBe(true);
    expect(acceptsTimeEntry("ON_HOLD")).toBe(false);
  });

  it("le message dit le nouveau statut et son effet sur la saisie", () => {
    expect(statusChangedMessage("Refonte FAQ en ligne", "IN_PROGRESS")).toContain("« En cours »");
  });
});
