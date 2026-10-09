"use client";
// Aperçu de la fiche RH (.ts-viewer, PROMPT.md §11.4) : barre d'outils (fichier, zoom,
// Télécharger le PDF, Imprimer) et la feuille au ratio A4 paysage. Le HTML de la
// feuille vient du gabarit unique (lib/attendance/html.ts), entièrement échappé.
import { useState } from "react";
import { Icon } from "@/components/ods/Icon";
import { dict, t } from "@/lib/i18n";

const a = dict.attendance;
const STEPS = [50, 75, 100, 125, 150];

export function SheetViewer({ fileName, html, pdfHref }: { fileName: string; html: string; pdfHref: string }) {
  const [zoom, setZoom] = useState(100);
  const index = STEPS.indexOf(zoom);
  return (
    <div className="ts-viewer">
      <div className="ts-viewer-bar">
        <span className="small fw-bold">{t(a.viewerFile, { file: fileName })}</span>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <button className="btn btn-icon btn-sm" type="button" aria-label={a.zoomOut} disabled={index === 0} onClick={() => setZoom(STEPS[index - 1]!)}>
            <Icon name="minus" />
          </button>
          <span className="small fw-bold" role="status">{t(a.zoomValue, { n: zoom })}</span>
          <button className="btn btn-icon btn-sm" type="button" aria-label={a.zoomIn} disabled={index === STEPS.length - 1} onClick={() => setZoom(STEPS[index + 1]!)}>
            <Icon name="plus" />
          </button>
          <a className="btn btn-sm" href={pdfHref} download={fileName}>{a.download}</a>
          <button className="btn btn-sm" type="button" onClick={() => window.print()}>{a.print}</button>
        </div>
      </div>
      <div className="ts-viewer-stage">
        <div className="ts-print-sheet" style={{ width: "100%", maxWidth: 940, zoom: zoom / 100 }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
