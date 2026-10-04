import type { ReactNode } from "react";

/** Cadre d'une planche : 1280 px, marge 60 px, comme dans design/ecrans. */
export function Planche({ title, lead, children, gap = 30, minHeight }: { title: string; lead: string; children: ReactNode; gap?: number; minHeight?: number }) {
  return (
    <div style={{ width: 1280, minHeight, boxSizing: "border-box", padding: 60, display: "flex", flexDirection: "column", gap, background: "#ffffff" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
      </div>
      {children}
    </div>
  );
}
