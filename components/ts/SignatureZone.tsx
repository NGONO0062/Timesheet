"use client";
// Zone de signature électronique (.ts-sign, .ts-trace, planche C3, PROMPT.md §9.8).
// Deux modes : tracé (souris, doigt, stylet) et mot de passe, toujours proposé.
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Checkbox } from "@/components/ods/Form";
import { FieldError } from "@/components/ods/Form";
import { Pills } from "@/components/ods/Disclosure";
import { formatDate, formatTime } from "@/lib/format";
import { dict, t } from "@/lib/i18n";

export type SignatureMethod = "DRAWN" | "PASSWORD";

export type SignedState = {
  method: SignatureMethod;
  signedAt: Date;
  /** Tracé : chemin SVG (viewBox 0 0 300 100). */
  drawing?: string;
  sha256?: string;
};

type Props = {
  signerName: string;
  signerRole: string;
  defaultMode?: SignatureMethod;
  /** Case « Je certifie l'exactitude… » à cocher avant de signer (fiche de présence). */
  requireCertify?: boolean;
  signed?: SignedState;
  /** Mot de passe : vérifié de nouveau côté serveur. Renvoie un message d'erreur ou null. */
  onSign?: (input: { method: SignatureMethod; drawing?: string; password?: string }) => Promise<string | null>;
  /**
   * « sheet » : mise en page de l'écran 06. Certification en tête, consigne sous le cadre,
   * traçabilité affichée à côté par la page (qui suit le mode par `onModeChange`).
   */
  variant?: "standalone" | "sheet";
  onModeChange?: (mode: SignatureMethod) => void;
  /** Champs propres à l'écran, placés avant les boutons (observation du superviseur). */
  extra?: ReactNode;
};

const W = 300;
const H = 100;

export function SignatureZone({ signerName, signerRole, defaultMode = "DRAWN", requireCertify, signed, onSign, variant = "standalone", onModeChange, extra }: Props) {
  const sheet = variant === "sheet";
  const [mode, setMode] = useState<SignatureMethod>(defaultMode);
  const [path, setPath] = useState("");
  const [password, setPassword] = useState("");
  const [certified, setCertified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drawing = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const methodLabel = (m: SignatureMethod) => (m === "DRAWN" ? dict.sign.methodDrawn : dict.sign.methodPassword);
  const signer = `${signerName} · ${signerRole}`;

  if (signed) {
    return (
      <div className="ts-sign">
        <div style={{ display: "flex", alignItems: "center", minHeight: 40 }}>
          <span className="badge bg-success">{dict.sign.signed}</span>
        </div>
        {signed.method === "DRAWN" && signed.drawing && (
          <div className="ts-sign-pad is-signed" role="img" aria-label={t(dict.sign.padSigned, { name: signerName })}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true">
              <path d={signed.drawing} stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {!sheet && (
          <Trace
            rows={[
              [dict.sign.signer, signer],
              [dict.sign.date, formatDate(toDay(signed.signedAt))],
              [dict.sign.time, `${formatTime(signed.signedAt, true)} (UTC+1)`],
              [dict.sign.method, methodLabel(signed.method)],
              ...(signed.sha256 ? [[dict.sign.fingerprint, signed.sha256] as [string, string]] : []),
            ]}
          />
        )}
        <p className="small text-secondary">{dict.sign.locked}</p>
      </div>
    );
  }

  function point(e: PointerEvent<SVGSVGElement>) {
    const box = svgRef.current!.getBoundingClientRect();
    const x = Math.round(((e.clientX - box.left) / box.width) * W);
    const y = Math.round(((e.clientY - box.top) / box.height) * H);
    return `${x} ${y}`;
  }

  const hasDrawing = path.length > 0;
  // Ce qui empêche de signer, écrit à côté du bouton désactivé (§5). En mode
  // mot de passe, le bouton reste actif (planche C3) : le manque s'affiche au clic.
  const missing =
    requireCertify && !certified
      ? dict.sign.needCertify
      : mode === "DRAWN" && !hasDrawing
        ? dict.sign.needDrawing
        : null;

  async function submit() {
    if (missing || !onSign) return;
    if (mode === "PASSWORD" && !password) {
      setError(dict.sign.needPassword);
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onSign(mode === "DRAWN" ? { method: mode, drawing: path } : { method: mode, password });
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className="ts-sign">
      {sheet && requireCertify && <Checkbox label={dict.sign.certify} checked={certified} onChange={(e) => setCertified(e.target.checked)} />}
      <Pills
        label={dict.sign.mode}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
          onModeChange?.(m);
        }}
        options={[
          { value: "DRAWN", label: dict.sign.draw },
          { value: "PASSWORD", label: sheet ? dict.attendance.passwordMode : dict.sign.password },
        ]}
      />
      {mode === "DRAWN" ? (
        <div className="ts-sign-pad" role="img" aria-label={hasDrawing ? t(dict.sign.padSigned, { name: signerName }) : dict.sign.padEmpty}>
          {!hasDrawing && (
            <span className="text-secondary" style={{ position: "absolute" }}>
              {dict.sign.padHint}
            </span>
          )}
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ touchAction: "none", cursor: "crosshair" }}
            aria-hidden="true"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drawing.current = true;
              setPath((p) => `${p} M ${point(e)}`.trim());
            }}
            onPointerMove={(e) => {
              if (drawing.current) setPath((p) => `${p} L ${point(e)}`);
            }}
            onPointerUp={() => {
              drawing.current = false;
            }}
          >
            {hasDrawing && <path d={path} stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          </svg>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: 200 }}>
          <p>{dict.sign.passwordIntro}</p>
          <div>
            <label className="form-label is-required" htmlFor="signature-mdp">
              {dict.sign.password}
            </label>
            <input
              className="form-control"
              id="signature-mdp"
              type="password"
              autoComplete="current-password"
              aria-required="true"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
      )}
      {sheet ? (
        <p className="small text-secondary">{dict.attendance.signHint}</p>
      ) : (
        <Trace
          rows={[
            [dict.sign.signer, signer],
            [dict.sign.date, dict.sign.atSigning],
            [dict.sign.time, dict.sign.atSigning],
            [dict.sign.method, methodLabel(mode)],
          ]}
        />
      )}
      {!sheet && requireCertify && <Checkbox label={dict.sign.certify} checked={certified} onChange={(e) => setCertified(e.target.checked)} />}
      {extra}
      {error && <FieldError id="signature-erreur">{error}</FieldError>}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
        {missing && <p className="small" style={{ marginRight: "auto" }}>{missing}</p>}
        {mode === "DRAWN" && (
          <button className="btn" type="button" disabled={!hasDrawing} onClick={() => setPath("")}>
            {dict.sign.clear}
          </button>
        )}
        <button className="btn btn-primary" type="button" disabled={Boolean(missing) || busy} onClick={submit}>
          {sheet ? dict.attendance.submit : dict.sign.submit}
        </button>
      </div>
    </div>
  );
}

function Trace({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="ts-trace" aria-label={dict.sign.trace}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Jour de l'instant à Douala, pour l'affichage de la date. */
function toDay(instant: Date): Date {
  const shifted = new Date(instant.getTime() + 60 * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}
