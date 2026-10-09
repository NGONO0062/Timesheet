"use client";
// Menu Exporter du journal (Dropdown : CSV, Excel, PDF), avec les filtres de l'écran.
import { Dropdown } from "@/components/ods/Dropdown";
import { Icon } from "@/components/ods/Icon";
import { dict, t } from "@/lib/i18n";

const au = dict.audit;

export function AuditExport({ query }: { query: string }) {
  return (
    <Dropdown
      label={au.export}
      items={(["csv", "xlsx", "pdf"] as const).map((f) => ({
        key: f,
        content: <span aria-label={t(au.exportLabel, { format: au.exportFormats[f] })}>{au.exportFormats[f]}</span>,
        href: `/plateforme/journal/export?${query}&format=${f}`,
      }))}
      trigger={(p) => (
        <button className="btn" type="button" {...p}>
          {au.export}
          <Icon name="down" />
        </button>
      )}
    />
  );
}
