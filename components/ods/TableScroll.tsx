"use client";
// Conteneur des tableaux larges (« .table-responsive »). Quand il défile, il devient
// atteignable au clavier, avec pour nom la légende du tableau (WCAG 2.1.1, règle axe
// scrollable-region-focusable) ; sinon, il n'ajoute pas d'arrêt de tabulation inutile.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export function TableScroll({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [name, setName] = useState(label);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!label) setName(el.querySelector("caption")?.textContent?.trim() || undefined);
    const check = () => setScrollable(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    const inner = el.firstElementChild;
    if (inner) observer.observe(inner);
    return () => observer.disconnect();
  }, [label]);

  return (
    <div
      ref={ref}
      className={cx("table-responsive", className)}
      tabIndex={scrollable ? 0 : undefined}
      role={scrollable ? "region" : undefined}
      aria-label={scrollable ? name : undefined}
    >
      {children}
    </div>
  );
}
