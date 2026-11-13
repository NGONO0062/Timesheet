// Structure de l'interface (PROMPT.md §6). Bureau (1024 px et plus) : barre latérale
// noire de 240 px. En dessous : barre haute et navigation dans un panneau.
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { homeFor, initials, isCurrent, navigationFor, roleLabel, type Viewer } from "@/entities/viewer";
import { useSignOut } from "@/features/auth";
import { dict } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { Icon } from "@/shared/ui/Icon";
import { Wordmark } from "@/shared/ui/Wordmark";

const NAV_LINK =
  "flex min-h-control w-full cursor-pointer items-center gap-10 rounded-md px-10 text-left font-bold text-white no-underline " +
  "hover:bg-white hover:text-black aria-[current=page]:accent-mark";

const GROUP = "flex flex-col gap-10 border-t-2 border-gray-999 pt-20";

function SideContent({ viewer, onNavigate }: { viewer: Viewer; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const items = navigationFor(viewer);
  const current = (href: string) => (isCurrent(href, pathname) ? "page" : undefined);

  return (
    <>
      <Link className="flex flex-col gap-5 px-10 font-normal text-white no-underline hover:text-white" to={homeFor(viewer)} onClick={onNavigate}>
        <span className="text-h3 font-bold">
          <Wordmark bare />
        </span>
        <span className="text-sm">{viewer.divisionName ?? dict.audit.allDivisions}</span>
      </Link>
      <nav className={GROUP} aria-label="Navigation principale">
        <ul className="flex flex-col gap-5">
          {items.map((item) => (
            <li key={item.href}>
              <Link className={NAV_LINK} to={item.href} aria-current={current(item.href)} onClick={onNavigate}>
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className={cx(GROUP, "mt-auto")}>
        <div className="flex items-center gap-10 px-10 pb-10">
          <span className="flex size-control flex-none items-center justify-center rounded-md bg-white font-bold text-black" aria-hidden="true">
            {initials(viewer)}
          </span>
          <span className="flex min-w-0 flex-col gap-5">
            <span className="font-bold">
              {viewer.firstName} {viewer.lastName}
            </span>
            <span className="text-sm">{roleLabel(viewer.role)}</span>
          </span>
        </div>
        <ul className="flex flex-col gap-5">
          <li>
            <Link className={NAV_LINK} to="/parametres" aria-current={current("/parametres")} onClick={onNavigate}>
              <Icon name="settings" />
              Paramètres
            </Link>
          </li>
          <li>
            <button
              className={NAV_LINK}
              type="button"
              disabled={signOut.isPending}
              onClick={() => signOut.mutate(undefined, { onSettled: () => navigate("/connexion", { replace: true }) })}
            >
              <Icon name="logout" />
              Se déconnecter
            </button>
          </li>
        </ul>
      </div>
    </>
  );
}

const FOOTER = [
  { label: "Aide", href: "/aide" },
  { label: "Accessibilité", href: "/accessibilite" },
  { label: "Données personnelles", href: "/donnees-personnelles" },
];

export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="flex min-h-screen items-stretch bg-white">
      <aside className="sticky top-0 hidden h-screen w-sidenav flex-none flex-col gap-20 overflow-y-auto bg-black px-10 py-20 text-white lg:flex">
        <SideContent viewer={viewer} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-black text-white lg:hidden">
          <div className="mx-auto flex min-h-60 w-full max-w-mobile items-center justify-between md:max-w-content md:px-30">
            <Link className="text-h3 font-bold text-white no-underline hover:text-white" to={homeFor(viewer)}>
              <Wordmark bare />
            </Link>
            <button
              className="inline-flex size-control-lg cursor-pointer items-center justify-center rounded-md border-2 border-white bg-black text-white hover:bg-white hover:text-black"
              type="button"
              aria-label="Ouvrir le menu"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </header>
        <Dialog open={menu} onClose={() => setMenu(false)} className="fixed inset-0 z-50 lg:hidden">
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <DialogPanel className="fixed inset-y-0 left-0 flex w-full max-w-nav-panel flex-col gap-20 overflow-y-auto border-r-2 border-black bg-black px-10 py-20 text-white">
            <div className="flex items-start justify-between gap-20 px-10">
              <DialogTitle as="h2" className="text-h3">
                Menu
              </DialogTitle>
              <button
                className="inline-flex size-control-sm cursor-pointer items-center justify-center rounded-sm border-2 border-white text-white hover:bg-white hover:text-black"
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setMenu(false)}
              >
                <Icon name="cross" />
              </button>
            </div>
            <SideContent viewer={viewer} onNavigate={() => setMenu(false)} />
          </DialogPanel>
        </Dialog>
        <div className="flex-1 py-30 lg:pb-60">
          <div className="mx-auto w-full max-w-mobile md:max-w-content md:px-30">{children}</div>
        </div>
        <footer className="border-t-2 border-black py-20">
          <div className="mx-auto flex w-full max-w-mobile flex-wrap items-center gap-x-30 gap-y-10 text-sm md:max-w-content md:px-30">
            <span>TimeSheet · usage interne</span>
            {FOOTER.map((l) => (
              <Link key={l.href} to={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
