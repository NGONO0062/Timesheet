"use client";
// Tooltip, Popover, Accordion, Tabs et Pills ODS.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./Icon";

/** Tooltip ODS : au survol et au focus, fermé par Échap (WCAG 1.4.13). */
export function Tooltip({ text, children }: { text: string; children: (props: { "aria-describedby": string }) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="ts-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      {children({ "aria-describedby": id })}
      <span className="tooltip" role="tooltip" id={id} hidden={!open}>
        {text}
      </span>
    </span>
  );
}

/** Popover ODS : ouvert par un bouton, fermé par Échap ou clic extérieur. */
export function Popover({ title, children, trigger, defaultOpen = false }: {
  title: string;
  children: ReactNode;
  trigger: (props: { "aria-expanded": boolean; "aria-controls": string; onClick: () => void }) => ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <span
      className="ts-tip"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      {trigger({ "aria-expanded": open, "aria-controls": id, onClick: () => setOpen((o) => !o) })}
      <div className="popover" id={id} role="region" aria-label={title} hidden={!open}>
        <p className="popover-header">{title}</p>
        <div className="popover-body">{children}</div>
      </div>
    </span>
  );
}

/** Accordion ODS. */
export function Accordion({ items, defaultOpen = [] }: { items: Array<{ key: string; title: ReactNode; content: ReactNode }>; defaultOpen?: string[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set(defaultOpen));
  const id = useId();
  return (
    <div className="accordion">
      {items.map((item) => {
        const isOpen = open.has(item.key);
        const panelId = `${id}-${item.key}`;
        return (
          <div className="accordion-item" key={item.key}>
            <h3 className="accordion-header h6">
              <button
                className={cx("accordion-button", !isOpen && "collapsed")}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.key)) next.delete(item.key);
                    else next.add(item.key);
                    return next;
                  })
                }
              >
                {item.title}
                <Icon name="down" />
              </button>
            </h3>
            <div className="accordion-body" id={panelId} hidden={!isOpen}>
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Pills ODS en filtre : boutons à bascule (aria-pressed), comme dans les maquettes.
 * La pill active porte une coche (§4.3, point 3).
 */
export function Pills<T extends string>({ label, options, value, onChange, size }: {
  label: string;
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  size?: "lg";
}) {
  return (
    <ul className="nav nav-pills" aria-label={label}>
      {options.map((o) => (
        <li key={o.value}>
          <button
            className={cx("nav-link", o.value === value && "active")}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            style={size === "lg" ? { minHeight: 50 } : undefined}
          >
            {o.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Tabs ODS : onglets et panneaux (tablist), flèches gauche / droite. */
export function Tabs({ label, tabs, variant = "tabs", defaultTab }: {
  label: string;
  tabs: Array<{ key: string; label: ReactNode; content: ReactNode }>;
  variant?: "tabs" | "pills";
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);
  const id = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const key = tabs[next]!.key;
    setActive(key);
    refs.current[key]?.focus();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className={cx("nav", variant === "tabs" ? "nav-tabs" : "nav-pills")} role="tablist" aria-label={label}>
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[tab.key] = el;
            }}
            className={cx("nav-link", tab.key === active && "active")}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.key}`}
            aria-selected={tab.key === active}
            aria-controls={`${id}-panel-${tab.key}`}
            tabIndex={tab.key === active ? 0 : -1}
            onClick={() => setActive(tab.key)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" id={`${id}-panel-${tab.key}`} aria-labelledby={`${id}-tab-${tab.key}`} hidden={tab.key !== active} tabIndex={0}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
