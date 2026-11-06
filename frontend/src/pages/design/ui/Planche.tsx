import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

/** Cadre d'une planche : 1280 px, marge 60 px, comme dans design/captures. */
export function Planche({ title, lead, children, className }: { title: string; lead: string; children: ReactNode; className?: string }) {
  return (
    <main className={cx("flex w-full max-w-planche flex-col gap-30 bg-white p-20 md:p-60", className)}>
      <div className="flex flex-col gap-10">
        <h1>{title}</h1>
        <p className="text-lead">{lead}</p>
      </div>
      {children}
    </main>
  );
}

/** Carte d'exemple d'une planche : titre h5, contenu, note grise. */
export function Exemple({ title, note, children, wide }: { title: string; note?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={cx("flex flex-col gap-20 rounded-md border-2 border-gray-999 bg-white p-20", wide && "col-span-full")}>
      <h2 className="text-h5">{title}</h2>
      {children}
      {note && <p className="text-sm text-gray-595">{note}</p>}
    </section>
  );
}
