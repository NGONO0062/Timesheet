// Onglets de l'écran Validation : fiches de temps, fiches de présence à signer
// (PROMPT.md §19, signature du superviseur). Des liens : chaque onglet a son adresse.
import Link from "next/link";
import { cx } from "@/lib/cx";
import { dict, t } from "@/lib/i18n";

const a = dict.attendance;

export function ValidationTabs({ current, presenceCount }: { current: "timesheets" | "presence"; presenceCount: number }) {
  const tabs = [
    { key: "timesheets", href: "/validation", label: a.timesheetsTab },
    { key: "presence", href: "/validation/presence", label: t(a.supervisorTab, { n: presenceCount }) },
  ] as const;
  return (
    <nav aria-label={a.validationSections}>
      <ul className="nav nav-tabs">
        {tabs.map((tab) => (
          <li className="nav-item" key={tab.key}>
            <Link className={cx("nav-link", current === tab.key && "active")} href={tab.href} aria-current={current === tab.key ? "page" : undefined}>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
