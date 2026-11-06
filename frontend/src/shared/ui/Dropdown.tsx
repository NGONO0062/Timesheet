// Dropdown ODS sur le Menu de HeadlessUI : flèches, Début / Fin, Échap, recherche
// par lettre, retour du focus au déclencheur. Le menu est ancré sous le bouton et
// rendu hors du flux : il n'est jamais coupé par un tableau à défilement.
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import type { ReactElement, ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import { Icon } from "./Icon";

export type DropdownItem = {
  key: string;
  content: ReactNode;
  /** Élément actuel : coché, annoncé par `currentSuffix` (ex. « (statut actuel) »). */
  current?: boolean;
  currentSuffix?: string;
  onSelect?: () => void;
  href?: string;
};

type Props = {
  /** Contenu du bouton déclencheur. */
  children: ReactNode | ((state: { open: boolean }) => ReactElement);
  /** Classes du bouton : reçoit l'état ouvert pour le style « ouvert ». */
  buttonClassName: string | ((state: { open: boolean }) => string);
  buttonLabel?: string;
  items: DropdownItem[];
  /** Nom de la liste pour les lecteurs d'écran. */
  label: string;
  /** Coche à droite (statuts) ou à gauche (liste des semaines). */
  checkSide?: "end" | "start";
  /** Menu à la largeur du bouton. */
  matchWidth?: boolean;
  /** Classes du menu (largeur…). */
  menuClassName?: string;
  /** Menu toujours affiché : planches de /design seulement. */
  staticOpen?: boolean;
  /** Classes du conteneur (bouton et menu). */
  className?: string;
};

const ITEM =
  "flex w-full cursor-pointer items-center justify-between gap-20 px-20 py-10 text-left font-bold text-black no-underline " +
  "data-focus:bg-black data-focus:text-white";

export function Dropdown({ children, buttonClassName, buttonLabel, items, label, checkSide = "end", matchWidth, menuClassName, staticOpen, className }: Props) {
  return (
    <Menu as="div" className={cx("relative flex", className)}>
      <MenuButton className={buttonClassName} aria-label={buttonLabel}>
        {children}
      </MenuButton>
      <MenuItems
        static={staticOpen}
        // Planche : la liste reste sous le bouton, dans le flux ; sinon, elle flotte et se replace.
        anchor={staticOpen ? undefined : { to: "bottom start", gap: 5, padding: 10 }}
        aria-label={label}
        className={cx(
          "z-50 rounded-md border-2 border-black bg-white focus:outline-none",
          staticOpen && "absolute top-full left-0 mt-5",
          matchWidth && "w-anchor",
          menuClassName,
        )}
      >
        {items.map((item) => {
          const body = (
            <>
              <span className="flex flex-1 items-center gap-5">
                {item.current && checkSide === "start" && <Icon name="check" size="glyph" />}
                {item.content}
              </span>
              {item.current && checkSide === "end" && <Icon name="check" size="glyph" />}
              {item.current && item.currentSuffix && <span className="sr-only">{item.currentSuffix}</span>}
            </>
          );
          const className = cx(ITEM, item.current && "bg-active");
          return (
            <MenuItem key={item.key}>
              {item.href ? (
                <a href={item.href} className={className} aria-current={item.current || undefined}>
                  {body}
                </a>
              ) : (
                <button type="button" className={className} onClick={item.onSelect}>
                  {body}
                </button>
              )}
            </MenuItem>
          );
        })}
      </MenuItems>
    </Menu>
  );
}
