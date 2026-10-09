import type { ReactNode } from "react";
import { notFound } from "next/navigation";

// Page /design et planches C1 à C4 : outil de développement, introuvable en production.
export default function DesignLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
