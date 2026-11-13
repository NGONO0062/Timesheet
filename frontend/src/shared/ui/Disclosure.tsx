// Tooltip, Popover, Accordion, Tabs et Pills ODS. Comportements accessibles de
// HeadlessUI (Popover, Disclosure, TabGroup) ; apparence des maquettes ODS.
import { Disclosure, DisclosureButton, DisclosurePanel, Popover as HPopover, PopoverButton, PopoverPanel, Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { useId, useState, type ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import { Icon } from "./Icon";

/** Tooltip ODS : au survol et au focus, fermé par Échap (WCAG 1.4.13). */
export function Tooltip({ text, children }: { text: string; children: (props: { "aria-describedby": string }) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      {children({ "aria-describedby": id })}
      <span
        className="absolute bottom-full left-1/2 z-50 mb-5 -translate-x-1/2 rounded-sm bg-black px-10 py-5 text-sm font-bold whitespace-nowrap text-white"
        role="tooltip"
        id={id}
        hidden={!open}
      >
        {text}
      </span>
    </span>
  );
}

/** Popover ODS : ouvert par un bouton, fermé par Échap ou clic extérieur. */
export function Popover({ title, children, button, buttonClassName }: { title: string; children: ReactNode; button: ReactNode; buttonClassName: string }) {
  return (
    <HPopover className="relative inline-flex">
      <PopoverButton className={buttonClassName}>{button}</PopoverButton>
      <PopoverPanel
        anchor={{ to: "bottom start", gap: 5, padding: 10 }}
        className="z-50 flex max-w-modal flex-col gap-10 rounded-md border-2 border-black bg-white p-20"
        aria-label={title}
      >
        <p className="font-bold">{title}</p>
        <div>{children}</div>
      </PopoverPanel>
    </HPopover>
  );
}

/** Accordion ODS. */
export function Accordion({ items, defaultOpen = [] }: { items: Array<{ key: string; title: ReactNode; content: ReactNode }>; defaultOpen?: string[] }) {
  return (
    <div className="overflow-hidden rounded-md border-2 border-gray-999">
      {items.map((item) => (
        <Disclosure key={item.key} as="div" defaultOpen={defaultOpen.includes(item.key)} className="border-b-2 border-gray-999 bg-white last:border-b-0">
          <h3 className="text-h6">
            <DisclosureButton className="group flex min-h-control-lg w-full cursor-pointer items-center justify-between gap-10 px-20 py-10 text-left font-bold hover:bg-black hover:text-white">
              {item.title}
              <Icon name="down" className="group-data-open:rotate-180" />
            </DisclosureButton>
          </h3>
          <DisclosurePanel className="px-20 pb-20">{item.content}</DisclosurePanel>
        </Disclosure>
      ))}
    </div>
  );
}

// Pastille : la couleur de fond dépend de l'état, posée une seule fois (pas de classes en concurrence).
const PILL = "inline-flex min-h-control cursor-pointer items-center justify-center gap-5 rounded-md border-2 border-black px-btn-x py-btn-y text-btn font-bold text-black";
const PILL_IDLE = "bg-white hover:bg-black hover:text-white";
const PILL_ACTIVE = "bg-black text-white";

/**
 * Pills ODS en filtre : boutons à bascule (aria-pressed), comme dans les maquettes.
 * La pill active porte une coche : l'état ne tient pas à la couleur seule.
 */
export function Pills<T extends string>({ label, options, value, onChange, size }: {
  label: string;
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  size?: "lg";
}) {
  return (
    <ul className="flex flex-wrap gap-10" aria-label={label}>
      {options.map((o) => (
        <li key={o.value}>
          <button className={cx(PILL, size === "lg" && "min-h-control-lg", o.value === value ? PILL_ACTIVE : PILL_IDLE)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.value === value && <Icon name="check" size="glyph" />}
            {o.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

const TAB =
  "relative top-border flex min-h-control cursor-pointer items-center rounded-t-md border-2 border-white border-b-black px-btn-x py-btn-y font-bold text-black " +
  "hover:border-black hover:bg-black hover:text-white data-selected:border-black data-selected:border-b-white data-selected:bg-white data-selected:text-black";

/** Tabs ODS : onglets et panneaux (tablist), flèches gauche / droite, Début / Fin. */
export function Tabs({ label, tabs, variant = "tabs", defaultTab }: {
  label: string;
  tabs: Array<{ key: string; label: ReactNode; content: ReactNode }>;
  variant?: "tabs" | "pills";
  defaultTab?: string;
}) {
  const defaultIndex = Math.max(0, tabs.findIndex((tab) => tab.key === defaultTab));
  return (
    <TabGroup defaultIndex={defaultIndex} className="flex flex-col gap-20">
      <TabList aria-label={label} className={cx("flex flex-wrap", variant === "tabs" ? "border-b-2 border-black" : "gap-10")}>
        {tabs.map((tab) => (
          <Tab key={tab.key} className={variant === "tabs" ? TAB : ({ selected }: { selected: boolean }) => cx(PILL, selected ? PILL_ACTIVE : PILL_IDLE)}>
            {tab.label}
          </Tab>
        ))}
      </TabList>
      <TabPanels>
        {tabs.map((tab) => (
          <TabPanel key={tab.key}>{tab.content}</TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}
