import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("est un bouton de type button par défaut (pas d'envoi de formulaire involontaire)", () => {
    render(<Button>Enregistrer</Button>);
    expect(screen.getByRole("button", { name: "Enregistrer" })).toHaveProperty("type", "button");
  });

  it("garde une bordure de 2 px, sauf en lien", () => {
    render(
      <>
        <Button variant="primary">Valider</Button>
        <Button variant="link">Annuler</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Valider" }).className).toContain("border-2");
    expect(screen.getByRole("button", { name: "Annuler" }).className).not.toContain("border-2");
  });

  it("désactivé : opaque, gris plein", () => {
    render(<Button disabled>Soumettre</Button>);
    const button = screen.getByRole("button", { name: "Soumettre" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.className).toContain("disabled:bg-gray-999");
    expect(button.className).not.toMatch(/opacity/);
  });
});
