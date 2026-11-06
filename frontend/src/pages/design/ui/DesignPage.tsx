import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@/shared/ui/Button";
import { Wordmark } from "@/shared/ui/Wordmark";

const VARIANTS: Array<[ButtonVariant, string]> = [
  ["primary", "Primaire"],
  ["default", "Secondaire"],
  ["dark", "Sombre"],
  ["success", "Succès"],
  ["danger", "Danger"],
  ["link", "Lien"],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-20 border-t-2 border-black pt-20">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

/** Composants dans tous leurs états, à comparer aux planches C1 à C4 (design/captures). */
export function DesignPage() {
  return (
    <main className="flex flex-col gap-30 p-30">
      <h1>
        <Wordmark /> · composants
      </h1>
      <Section title="Boutons">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex flex-wrap items-center gap-10">
            {VARIANTS.map(([variant, label]) => (
              <Button key={variant} variant={variant} size={size}>
                {label}
              </Button>
            ))}
            <Button size={size} disabled>
              Désactivé
            </Button>
          </div>
        ))}
      </Section>
    </main>
  );
}
