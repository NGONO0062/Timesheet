// Zone de signature électronique (planche C3, PROMPT.md §9.8).
// Deux modes : tracé (souris, doigt, stylet) et mot de passe, toujours proposé.
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import { formatDate, formatTime } from "@/shared/lib/format";
import { dict, t } from "@/shared/i18n";
import { Button } from "@/shared/ui/Button";
import { Pills } from "@/shared/ui/Disclosure";
import { Badge } from "@/shared/ui/Display";
import { Checkbox, CONTROL, FieldError } from "@/shared/ui/Form";

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

/** Cadre de signature, avec la ligne de base grise à 60 px du bas. */
const PAD =
  "relative flex h-pad items-center justify-center rounded-md border-2 border-black " +
  "after:absolute after:inset-x-20 after:bottom-60 after:border-t-2 after:border-gray-999";

const STROKE = { strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

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
      <div className="flex flex-col gap-20">
        <div className="flex min-h-control items-center">
          <Badge tone="success">{dict.sign.signed}</Badge>
        </div>
        {signed.method === "DRAWN" && signed.drawing && (
          <div className={cx(PAD, "bg-white")} role="img" aria-label={t(dict.sign.padSigned, { name: signerName })}>
            <svg className="relative max-w-full" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true">
              <path d={signed.drawing} className="stroke-black" {...STROKE} />
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
        <p className="text-sm text-gray-595">{dict.sign.locked}</p>
      </div>
    );
  }

  function point(e: PointerEvent<SVGSVGElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return "0 0";
    const x = Math.round(((e.clientX - box.left) / box.width) * W);
    const y = Math.round(((e.clientY - box.top) / box.height) * H);
    return `${x} ${y}`;
  }

  const hasDrawing = path.length > 0;
  // Ce qui empêche de signer, écrit à côté du bouton désactivé (§5). En mode
  // mot de passe, le bouton reste actif (planche C3) : le manque s'affiche au clic.
  const missing = requireCertify && !certified ? dict.sign.needCertify : mode === "DRAWN" && !hasDrawing ? dict.sign.needDrawing : null;

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

  const certify = requireCertify && <Checkbox label={dict.sign.certify} checked={certified} onChange={(e) => setCertified(e.target.checked)} />;

  return (
    <div className="flex flex-col gap-20">
      {sheet && certify}
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
        <div className={cx(PAD, "border-dashed bg-gray-fa")} role="img" aria-label={hasDrawing ? t(dict.sign.padSigned, { name: signerName }) : dict.sign.padEmpty}>
          {!hasDrawing && <span className="absolute text-gray-595">{dict.sign.padHint}</span>}
          <svg
            ref={svgRef}
            className="relative size-full cursor-crosshair touch-none"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
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
            {hasDrawing && <path d={path} fill="none" className="stroke-black" vectorEffect="non-scaling-stroke" {...STROKE} />}
          </svg>
        </div>
      ) : (
        <div className="flex min-h-pad flex-col gap-20">
          <p>{dict.sign.passwordIntro}</p>
          <div>
            <label className="required-mark mb-5 block font-bold" htmlFor="signature-mdp">
              {dict.sign.password}
            </label>
            <input
              className={cx(CONTROL, "h-control rounded-md")}
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
        <p className="text-sm text-gray-595">{dict.attendance.signHint}</p>
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
      {!sheet && certify}
      {extra}
      {error && <FieldError id="signature-erreur">{error}</FieldError>}
      <div className="flex flex-wrap items-center justify-end gap-10">
        {missing && <p className="mr-auto text-sm">{missing}</p>}
        {mode === "DRAWN" && (
          <Button disabled={!hasDrawing} onClick={() => setPath("")}>
            {dict.sign.clear}
          </Button>
        )}
        <Button variant="primary" disabled={Boolean(missing) || busy} onClick={submit}>
          {sheet ? dict.attendance.submit : dict.sign.submit}
        </Button>
      </div>
    </div>
  );
}

function Trace({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-trace gap-x-20 gap-y-10 rounded-md border-2 border-gray-999 bg-gray-fa p-20 text-sm" aria-label={dict.sign.trace}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-595">{k}</dt>
          <dd className="font-bold wrap-anywhere">{v}</dd>
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
