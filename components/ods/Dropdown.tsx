"use client";
// Dropdown ODS : bouton de menu. Flèches haut / bas, Début / Fin, Échap,
// fermeture au clic extérieur, retour du focus sur le déclencheur.
import { useEffect, useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type DropdownItem = {
  key: string;
  content: ReactNode;
  /** Élément actuel : coché, annoncé par `suffix` (ex. « (statut actuel) »). */
  current?: boolean;
  currentSuffix?: string;
  onSelect?: () => void;
  href?: string;
};

type Props = {
  /** Rend le déclencheur. Il reçoit les attributs ARIA à poser. */
  trigger: (props: {
    id: string;
    "aria-haspopup": "true";
    "aria-expanded": boolean;
    "aria-controls": string;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  }) => ReactNode;
  items: DropdownItem[];
  label: string;
  /** Style « .is-current » (coche à droite) ou « aria-current » (coche à gauche, liste de semaines). */
  currentStyle?: "class" | "aria";
  menuStyle?: CSSProperties;
  defaultOpen?: boolean;
  className?: string;
};

export function Dropdown({ trigger, items, label, currentStyle = "class", menuStyle, defaultOpen = false, className }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const menuId = `${id}-menu`;
  const [focusOnOpen, setFocusOnOpen] = useState<"first" | "last" | null>(null);
  const menuItems = () => Array.from(document.getElementById(menuId)?.querySelectorAll<HTMLElement>(".dropdown-item") ?? []);

  useEffect(() => {
    if (!open) return;
    if (focusOnOpen) {
      const list = Array.from(document.getElementById(menuId)?.querySelectorAll<HTMLElement>(".dropdown-item") ?? []);
      (focusOnOpen === "first" ? list[0] : list[list.length - 1])?.focus();
    }
    function onDocDown(e: MouseEvent) {
      if (!document.getElementById(id)?.parentElement?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open, focusOnOpen, id, menuId]);

  function close(returnFocus = true) {
    setOpen(false);
    setFocusOnOpen(null);
    if (returnFocus) document.getElementById(id)?.focus();
  }

  function onTriggerKey(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (open) {
        const list = menuItems();
        (e.key === "ArrowDown" ? list[0] : list[list.length - 1])?.focus();
      } else {
        setFocusOnOpen(e.key === "ArrowDown" ? "first" : "last");
        setOpen(true);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  }

  function onMenuKey(e: KeyboardEvent<HTMLUListElement>) {
    const list = menuItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => list[(i + list.length) % list.length]?.focus();
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); move(index + 1); break;
      case "ArrowUp": e.preventDefault(); move(index - 1); break;
      case "Home": e.preventDefault(); move(0); break;
      case "End": e.preventDefault(); move(list.length - 1); break;
      case "Escape": e.preventDefault(); close(); break;
      case "Tab": setOpen(false); break;
    }
  }

  return (
    <div className={cx("dropdown", className)}>
      {trigger({
        id,
        "aria-haspopup": "true",
        "aria-expanded": open,
        "aria-controls": menuId,
        onClick: () => setOpen((o) => !o),
        onKeyDown: onTriggerKey,
      })}
      {open && (
        <ul className="dropdown-menu" id={menuId} aria-label={label} style={menuStyle} onKeyDown={onMenuKey}>
          {items.map((item) => {
            const current = item.current && currentStyle === "class";
            const common = {
              className: cx("dropdown-item", current && "is-current"),
              "aria-current": item.current && currentStyle === "aria" ? ("true" as const) : undefined,
            };
            const body = (
              <>
                {item.content}
                {item.current && item.currentSuffix && <span className="visually-hidden">{item.currentSuffix}</span>}
              </>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <a {...common} href={item.href} onClick={() => close(false)}>
                    {body}
                  </a>
                ) : (
                  <button
                    {...common}
                    type="button"
                    onClick={() => {
                      close();
                      item.onSelect?.();
                    }}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
