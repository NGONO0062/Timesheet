// Aperçu de la fiche (.ts-viewer, PROMPT.md §11.4) : barre d'outils (fichier, zoom,
// Télécharger le PDF, Imprimer) et la feuille A4 paysage. La feuille est le document
// du gabarit unique (le même que le PDF), affiché dans un cadre isolé sans script.
// 100 % : la feuille à la largeur de l'aperçu (planche 06) ; au-delà, l'aperçu défile.
import { useEffect, useRef, useState } from "react";
import { dict, t } from "@/shared/i18n";
import { cx } from "@/shared/lib/cx";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Icon } from "@/shared/ui/Icon";

const a = dict.attendance;
const STEPS = [50, 75, 100, 125, 150] as const;
/** Feuille A4 paysage : 297 × 210 mm à 96 ppp. */
const SHEET_W = 1123;
const SHEET_H = 794;

/** Document de la feuille à l'échelle voulue (zoom posé sur la racine du document). */
export function scaledSheet(html: string, scale: number): string {
  const style = `<style>html{zoom:${scale.toFixed(4)}}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : style + html;
}

/** Impression : le document à l'échelle 1, dans un cadre caché, retiré après l'impression. */
function printSheet(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.setAttribute("aria-hidden", "true");
  frame.className = "sr-only";
  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };
  document.body.appendChild(frame);
}

export function SheetViewer({ fileName, html, pdfHref }: { fileName: string; html: string; pdfHref: string }) {
  const [index, setIndex] = useState(2);
  const zoom = STEPS[index] ?? 100;
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  // Largeur utile de l'aperçu : la feuille y tient entière à 100 %.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 4;
      if (inner > 0) setFit(Math.min(1, inner / SHEET_W));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = fit * (zoom / 100);
  const title = t(a.viewerFile, { file: fileName });
  return (
    <div className="flex flex-col rounded-md border-2 border-black">
      <div className="flex flex-wrap items-center justify-between gap-x-20 gap-y-10 border-b-2 border-black bg-white px-10 py-10">
        <span className="text-sm font-bold wrap-anywhere">{title}</span>
        <div className="flex flex-wrap items-center gap-10">
          <Button size="sm" className="w-control-sm px-0" aria-label={a.zoomOut} disabled={index === 0} onClick={() => setIndex(index - 1)}>
            <Icon name="minus" />
          </Button>
          <span className="text-sm font-bold tabular-nums" role="status">
            {t(a.zoomValue, { n: zoom })}
          </span>
          <Button size="sm" className="w-control-sm px-0" aria-label={a.zoomIn} disabled={index === STEPS.length - 1} onClick={() => setIndex(index + 1)}>
            <Icon name="plus" />
          </Button>
          <a className={cx(buttonClass("default", "sm"), "no-underline")} href={pdfHref} download={fileName}>
            {a.download}
          </a>
          <Button size="sm" onClick={() => printSheet(html)}>
            {a.print}
          </Button>
        </div>
      </div>
      <div ref={stage} className="overflow-auto bg-gray-ddd p-30" role="region" aria-label={a.preview} tabIndex={0}>
        {/* Cadre sans script ni accès à la page (sandbox vide). */}
        <iframe
          title={title}
          srcDoc={scaledSheet(html, scale)}
          sandbox=""
          width={Math.round(SHEET_W * scale) + 4}
          height={Math.round(SHEET_H * scale) + 4}
          className="mx-auto block max-w-none border-2 border-gray-999 bg-white"
        />
      </div>
    </div>
  );
}
