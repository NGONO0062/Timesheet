// Fiche de présence (écran 06), telle que l'API la renvoie (/api/v1/fiches-presence).
import type { AttendanceStatus } from "@/shared/lib/status";

export type SignatureMethod = "DRAWN" | "PASSWORD";

export type AttendanceSignature = {
  name: string;
  role: string;
  method: SignatureMethod;
  drawing: string | null;
  signedAt: string;
  sha256: string;
};

export type AttendanceMonth = { year: number; month: number; status: AttendanceStatus };

export type AttendanceSheet = {
  id: string;
  year: number;
  month: number;
  status: AttendanceStatus;
  generatedAt: string;
  fileName: string;
  /** Document complet de la feuille : le même que le PDF, entièrement échappé côté serveur. */
  html: string;
  usedWeeks: number;
  internName: string;
  arrival: string;
  departure: string;
  supervisorName: string;
  internSignature: AttendanceSignature | null;
  supervisorSignature: AttendanceSignature | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  sentAt: string | null;
  sentTo: string | null;
  hrEmail: string | null;
  hrAutoSend: boolean;
  observation: string;
  /** La signature attendue est celle de la personne connectée. */
  canSign: boolean;
};

export type SupervisedRow = { id: string; name: string; year: number; month: number; status: AttendanceStatus; internSignedAt: string | null };

/** Fiches des stagiaires supervisés : nombre de stagiaires, fiches à signer, lignes. */
export type SupervisedList = { interns: number; toSign: number; rows: SupervisedRow[] };

export type SignResult = { status: AttendanceStatus; supervisor: string | null; sentTo: string | null; sendFailed: boolean };

export type SignInput = { method: SignatureMethod; drawing?: string; password?: string; observation?: string };
