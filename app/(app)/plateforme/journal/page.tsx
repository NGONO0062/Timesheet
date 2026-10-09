// Journal d'audit seul (navigation de l'admin plateforme, PROMPT.md §9.10).
import type { Metadata } from "next";
import type { AuditParams } from "@/lib/audit/filters";
import { requirePlatformAdmin } from "@/lib/data/viewer";
import { dict } from "@/lib/i18n";
import { AuditLog } from "../AuditLog";
import { loadAudit } from "../load";

export const metadata: Metadata = { title: dict.audit.title };

export default async function Page({ searchParams }: { searchParams: Promise<AuditParams> }) {
  const viewer = await requirePlatformAdmin();
  const audit = await loadAudit({ userId: viewer.userId, role: "PLATFORM_ADMIN" }, await searchParams);
  return (
    <main className="container ts-stack">
      <AuditLog path="/plateforme/journal" headingLevel={1} {...audit} />
    </main>
  );
}
