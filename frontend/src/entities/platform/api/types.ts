// Administration plateforme (écran 13), telle que l'API la renvoie (/api/v1/plateforme).
import type { Matrix, Rules, Workflow } from "@/entities/admin";
import type { Role } from "@/entities/viewer";
import type { AuditResult, DivisionStatus } from "@/shared/lib/status";

export type DivisionRow = { id: string; name: string; slug: string; pilot: boolean; admin: string | null; users: number; status: DivisionStatus; step: number; createdAt: string };

export type DivisionDetail = { id: string; name: string; slug: string; direction: string; status: DivisionStatus; step: number; createdAt: string; users: number; admins: string[] };

export type Identity = { name: string; slug: string; direction: string };

export type OnboardingAdmin = { fullName: string; email: string; config: "COPY" | "BLANK" };

export type Onboarding = {
  id: string;
  step: number;
  identity: Identity;
  admin: OnboardingAdmin | null;
  config: "COPY" | "BLANK" | null;
  matrix: Matrix;
  workflow: Workflow;
  rules: Rules;
  /** Nom de la division pilote, dont la configuration peut être reprise. */
  pilotName: string;
};

export type AuditRow = {
  id: string;
  at: string;
  /** null : échec de connexion, personne n'a prouvé son identité. */
  actor: string | null;
  actorRole: Role | null;
  division: string | null;
  action: string;
  actionLabel: string;
  objectLabel: string;
  result: AuditResult;
};

export type AuditPage = {
  from: string;
  to: string;
  /** Erreurs de date : « date » (format) ou « order » (fin avant début). */
  errors: { from?: "date" | "order"; to?: "date" | "order" };
  rows: AuditRow[];
  total: number;
  page: number;
  count: number;
  fromIndex: number;
  toIndex: number;
  divisions: Array<{ id: string; name: string }>;
};

export type AuditFilters = { division: string | null; type: string | null; from: string | null; to: string | null; q: string; page: number };
