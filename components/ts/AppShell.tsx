"use client";
// Structure de l'interface (PROMPT.md §6). Desktop : barre latérale noire de
// 240 px. Sous 1024 px : barre haute et navigation dans un Offcanvas.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Footer, Wordmark } from "@/components/ods/Navigation";
import { Icon } from "@/components/ods/Icon";
import { Offcanvas } from "@/components/ods/Overlay";
import { isCurrent, type NavItem } from "@/lib/navigation";

export type ShellUser = { initials: string; name: string; roleLabel: string; divisionLabel: string };

type Props = {
  items: NavItem[];
  home: string;
  user: ShellUser;
  logout: () => Promise<void>;
  children: ReactNode;
};

function NavLinks({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="sidenav-list">
      {items.map((item) => (
        <li key={item.href}>
          <Link className="nav-link" href={item.href} aria-current={isCurrent(item.href, pathname) ? "page" : undefined} onClick={onNavigate}>
            <Icon name={item.icon} />
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SideContent({ items, home, user, logout, pathname, onNavigate }: Omit<Props, "children"> & { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <Link className="sidenav-brand" href={home} onClick={onNavigate}>
        <span className="sidenav-brand-text">
          <span className="sidenav-app">
            <Wordmark />
          </span>
          <span className="small">{user.divisionLabel}</span>
        </span>
      </Link>
      <nav className="sidenav-group" aria-label="Navigation principale">
        <NavLinks items={items} pathname={pathname} onNavigate={onNavigate} />
      </nav>
      <div className="sidenav-group">
        <div className="sidenav-user">
          <span className="sidenav-avatar" aria-hidden="true">
            {user.initials}
          </span>
          <span className="sidenav-user-text">
            <span className="fw-bold">{user.name}</span>
            <span className="small">{user.roleLabel}</span>
          </span>
        </div>
        <ul className="sidenav-list">
          <li>
            <Link className="nav-link" href="/parametres" aria-current={isCurrent("/parametres", pathname) ? "page" : undefined} onClick={onNavigate}>
              <Icon name="settings" />
              Paramètres
            </Link>
          </li>
          <li>
            <form action={logout}>
              <button className="nav-link" type="submit">
                <Icon name="logout" />
                Se déconnecter
              </button>
            </form>
          </li>
        </ul>
      </div>
    </>
  );
}

export function AppShell(props: Props) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  return (
    <div className="page">
      <aside className="sidenav">
        <SideContent {...props} pathname={pathname} />
      </aside>
      <div className="page-body">
        <header className="navbar ts-topbar">
          <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 60 }}>
            <Link className="navbar-brand" href={props.home}>
              <Wordmark />
            </Link>
            <button
              className="navbar-user"
              type="button"
              aria-label="Ouvrir le menu"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
              style={{ width: 50, minHeight: 50, justifyContent: "center", padding: 0, borderColor: "#ffffff" }}
            >
              <Icon name="menu" />
            </button>
          </div>
        </header>
        <Offcanvas open={menu} onClose={() => setMenu(false)} title="Menu" closeLabel="Fermer le menu" side="start" className="sidenav ts-nav-panel">
          <SideContent {...props} pathname={pathname} onNavigate={() => setMenu(false)} />
        </Offcanvas>
        {props.children}
        <Footer />
      </div>
    </div>
  );
}
