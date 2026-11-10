// Composants ODS de navigation : Breadcrumb, Pagination, Stepped process,
// Navbar (sans logo), Footer. Reproduits avec Tailwind (design/ods.css).
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cx } from "@/shared/lib/cx";
import { pageItems } from "@/shared/lib/pagination";
import { dict, t } from "@/shared/i18n";
import { Icon } from "./Icon";
import { Wordmark } from "./Wordmark";

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label={dict.nav.breadcrumb}>
      <ol className="flex flex-wrap items-center gap-x-10 gap-y-5 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-10">
            {i > 0 && <Icon name="right" size="tiny" />}
            {item.href && i < items.length - 1 ? (
              <Link to={item.href}>{item.label}</Link>
            ) : (
              <span className="font-bold" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const PAGE_LINK =
  "flex h-control min-w-control items-center justify-center rounded-md border-2 border-white px-10 font-bold text-black no-underline " +
  "hover:border-black hover:bg-black hover:text-white aria-[current=page]:border-black aria-[current=page]:bg-black aria-[current=page]:text-white";

/** Pagination ODS. `href(n)` construit le lien de la page n. */
export function Pagination({ page, pageCount, href, label = dict.nav.pagination }: { page: number; pageCount: number; href: (n: number) => string; label?: string }) {
  if (pageCount <= 1) return null;
  const pages = pageItems(page, pageCount);
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-5">
        {page > 1 && (
          <li>
            <Link className={PAGE_LINK} to={href(page - 1)} aria-label={dict.nav.previousPage}>
              <Icon name="left" />
            </Link>
          </li>
        )}
        {pages.map((n, i) =>
          n === "…" ? (
            <li key={`ellipse-${i}`} aria-hidden="true">
              <span className="flex h-control min-w-control items-center justify-center font-bold">…</span>
            </li>
          ) : (
            <li key={n}>
              <Link className={PAGE_LINK} to={href(n)} aria-current={n === page ? "page" : undefined} aria-label={t(dict.nav.page, { n })}>
                {n}
              </Link>
            </li>
          ),
        )}
        {page < pageCount && (
          <li>
            <Link className={PAGE_LINK} to={href(page + 1)} aria-label={dict.nav.nextPage}>
              <Icon name="right" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

/** Ancres d'une page longue (« Sur cette page : », planches 12 et 14). */
export function AnchorNav({ label, items }: { label: string; items: Array<{ id: string; label: string }> }) {
  return (
    <nav aria-labelledby="sur-cette-page" className="flex flex-wrap items-baseline gap-x-30 gap-y-10">
      <p id="sur-cette-page" className="text-sm text-gray-595">
        {label}
      </p>
      {items.map((x) => (
        <a key={x.id} href={`#${x.id}`}>
          {x.label}
        </a>
      ))}
    </nav>
  );
}

/** Stepped process ODS. `current` : index de l'étape en cours (0 = première). */
export function SteppedProcess({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol className="flex gap-5" aria-label={label}>
      {steps.map((step, i) => (
        <li
          key={step}
          className={cx(
            "flex min-h-control flex-1 items-center gap-5 py-10 pr-20 font-bold",
            i === 0 ? "step-first pl-20" : "step-arrow pl-30",
            i < current ? "bg-black text-white" : i === current ? "bg-active text-black" : "bg-gray-ddd text-black",
          )}
          aria-current={i === current ? "step" : undefined}
        >
          {i + 1}. {step}
        </li>
      ))}
    </ol>
  );
}

const NAV_LINK =
  "relative flex h-full min-h-60 items-center px-10 font-bold text-white no-underline hover:bg-white hover:text-black " +
  "aria-[current=page]:text-active aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-10 aria-[current=page]:after:bottom-0 " +
  "aria-[current=page]:after:h-5 aria-[current=page]:after:bg-active";

export { NAV_LINK };

/** Orange navbar ODS, sans logo. */
export function Navbar({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <header className="bg-black text-white">
      <div className="mx-auto flex min-h-60 max-w-page flex-wrap items-stretch gap-x-30 px-20">
        <Link className="flex items-center text-h3 font-bold text-white no-underline hover:text-white" to={href}>
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
export function Footer() {
  return (
    <footer className="bg-black py-20 text-white">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-30 gap-y-10 px-20 text-sm">
        <span>TimeSheet · usage interne</span>
        {FOOTER_LINKS.map((l) => (
          <Link key={l.href} to={l.href} className="text-white hover:text-primary">
            {l.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
