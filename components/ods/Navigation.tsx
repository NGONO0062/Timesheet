// Composants ODS de navigation : Breadcrumb, Pagination, Stepped process,
// Navbar (sans logo), Footer.
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { dict, t } from "@/lib/i18n";
import { Icon } from "./Icon";

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label={dict.nav.breadcrumb}>
      <ol className="breadcrumb">
        {items.map((item, i) => (
          <li key={i}>
            {item.href && i < items.length - 1 ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Pagination ODS. `href(n)` construit le lien de la page n. */
export function Pagination({ page, pageCount, href, label = dict.nav.pagination }: { page: number; pageCount: number; href: (n: number) => string; label?: string }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <nav aria-label={label}>
      <ul className="pagination">
        {page > 1 && (
          <li>
            <Link className="page-link" href={href(page - 1)} aria-label={dict.nav.previousPage}>
              <Icon name="left" />
            </Link>
          </li>
        )}
        {pages.map((n) => (
          <li key={n}>
            <Link className="page-link" href={href(n)} aria-current={n === page ? "page" : undefined} aria-label={t(dict.nav.page, { n })}>
              {n}
            </Link>
          </li>
        ))}
        {page < pageCount && (
          <li>
            <Link className="page-link" href={href(page + 1)} aria-label={dict.nav.nextPage}>
              <Icon name="right" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

/** Stepped process ODS. `current` : index de l'étape en cours (0 = première). */
export function SteppedProcess({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol className="stepped-process" aria-label={label}>
      {steps.map((step, i) => (
        <li key={step} className={cx(i < current && "is-done", i === current && "is-current")} aria-current={i === current ? "step" : undefined}>
          {step}
        </li>
      ))}
    </ol>
  );
}

/** Le mot TimeSheet : « Time » en #f16e00, « Sheet » en blanc sur noir. Pas de logo. */
export function Wordmark() {
  return (
    <span>
      <span className="wm-time">{dict.app.wordTime}</span>
      {dict.app.wordSheet}
    </span>
  );
}

/** Orange navbar ODS, sans logo. */
export function Navbar({ href, compact, children }: { href: string; compact?: boolean; children?: ReactNode }) {
  return (
    <header className="navbar">
      <div className={compact ? "container-xs" : "container"} style={compact ? { display: "flex", alignItems: "center", minHeight: 60 } : undefined}>
        <Link className="navbar-brand" href={href}>
          <Wordmark />
        </Link>
        {children}
      </div>
    </header>
  );
}

const FOOTER_LINKS = [
  { label: "Aide", href: "/aide" },
  { label: "Accessibilité", href: "/accessibilite" },
  { label: "Données personnelles", href: "/donnees-personnelles" },
];

/** Footer ODS. */
export function Footer({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="footer">
        <div className="container-xs" style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", fontSize: 14, lineHeight: "16px" }}>
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
      </footer>
    );
  }
  return (
    <footer className="footer">
      <div className="container">
        <span>TimeSheet · usage interne</span>
        {FOOTER_LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
