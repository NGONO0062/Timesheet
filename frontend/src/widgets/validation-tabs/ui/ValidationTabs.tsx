// Onglets de l'écran Validation : fiches de temps, fiches de présence à signer
// (PROMPT.md §19, signature du superviseur). Des liens : chaque onglet a son adresse.
// Affichés seulement à qui supervise au moins un stagiaire.
import { Link } from "react-router";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";

const a = dict.attendance;

// Même tracé que les Tabs ODS (shared/ui/Disclosure), en liens.
const TAB =
  "relative top-border flex min-h-control items-center rounded-t-md border-2 border-white border-b-black px-btn-x py-btn-y font-bold text-black no-underline " +
  "hover:border-black hover:bg-black hover:text-white";
const ACTIVE = "border-black border-b-white bg-white hover:bg-white hover:text-black";

export function ValidationTabs({ current, presenceCount }: { current: "timesheets" | "presence"; presenceCount: number }) {
  const tabs = [
    { key: "timesheets", href: "/validation", label: a.timesheetsTab },
    { key: "presence", href: "/validation/presence", label: t(a.supervisorTab, { n: presenceCount }) },
  ] as const;
  return (
    <nav aria-label={a.validationSections}>
      <ul className="flex flex-wrap border-b-2 border-black">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link className={cx(TAB, current === tab.key && ACTIVE)} to={tab.href} aria-current={current === tab.key ? "page" : undefined}>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
