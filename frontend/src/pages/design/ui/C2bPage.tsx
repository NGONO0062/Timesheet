import { useState, type ReactNode } from "react";
import type { DayValue } from "@/entities/timesheet";
import type { TimesheetStatus } from "@/shared/lib/status";
import { Alert } from "@/shared/ui/Display";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { DayEntry } from "@/widgets/day-entry";
import { CHOICES, DAYS, EXPECTED, SubmitBar, useDays } from "./day-demo";
import { Planche } from "./Planche";

// Planche C2-B, version 2 (docs/design-v2.md) : soumise, rejetée, validée, et la vue du
// manager qui signale une journée. En lecture seule, le choix devient du texte.
const WEEK: DayValue[] = ["souscription-tests", "souscription-tests", "nps-analyse", "souscription-atelier", "irritants-atelier"];
const FLAGGED = [false, false, false, true, false];

function Section({ title, status, children }: { title: string; status: TimesheetStatus; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-20">
      <div className="flex flex-wrap items-center gap-x-20 gap-y-10">
        <h2 className="text-h3">{title}</h2>
        <StatusBadge kind="timesheet" value={status} />
      </div>
      {children}
    </section>
  );
}

function Rejected() {
  const days = useDays(WEEK);
  return (
    <>
      <DayEntry caption="Semaine rejetée, de nouveau modifiable, une journée signalée" days={DAYS} expected={EXPECTED} choices={CHOICES} values={days.values} onChange={days.onChange} flagged={FLAGGED} />
      <SubmitBar summary={days.summary} submitLabel="Soumettre à nouveau" />
    </>
  );
}

function ManagerView() {
  const [flags, setFlags] = useState([false, false, false, false, false]);
  return (
    <DayEntry
      caption="Vue du manager : chaque journée peut être signalée avant un rejet"
      days={DAYS}
      expected={EXPECTED}
      choices={CHOICES}
      values={WEEK}
      readOnly
      flagged={flags}
      onToggleFlag={(j) => setFlags((fs) => fs.map((f, k) => (k === j ? !f : f)))}
    />
  );
}

export function C2bPage() {
  return (
    <Planche className="gap-60" title="Saisie par jour, après soumission" lead="Soumise, rejetée, validée. En lecture seule, le choix devient du texte, pas une liste désactivée.">
      <Section title="4. Soumise" status="SUBMITTED">
        <Alert tone="info">
          <p>Soumise le 20 mars 2026 à 16:42. En attente de validation par Samuel Etoga. La fiche n&apos;est plus modifiable.</p>
        </Alert>
        <DayEntry caption="Semaine soumise, en lecture seule" days={DAYS} expected={EXPECTED} choices={CHOICES} values={WEEK} readOnly />
      </Section>
      <Section title="5. Rejetée" status="REJECTED">
        <Alert tone="danger" role="alert" heading="Fiche rejetée par Samuel Etoga, le 23 mars 2026 à 09:15">
          <p>Motif : « Jeudi 19 mars, journée déclarée sur Refonte parcours souscription alors que l&apos;atelier a été annulé. Merci de réaffecter cette journée. »</p>
        </Alert>
        <Rejected />
      </Section>
      <Section title="6. Validée" status="VALIDATED">
        <Alert tone="success">
          <p>Validée par Samuel Etoga le 24 mars 2026 à 11:30. La fiche est verrouillée.</p>
        </Alert>
        <DayEntry caption="Semaine validée, en lecture seule" days={DAYS} expected={EXPECTED} choices={CHOICES} values={WEEK} readOnly />
      </Section>
      <Section title="Vue du manager (écran 08)" status="SUBMITTED">
        <p>Le manager clique sur une journée pour la signaler ; elle sera marquée « À corriger » chez le collaborateur.</p>
        <ManagerView />
      </Section>
    </Planche>
  );
}
