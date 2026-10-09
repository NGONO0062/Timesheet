// Écran 13 : onboarding d'une division (PROMPT.md §9.10, planche 13-Onboarding-division).
// Sans `division`, l'étape 1 crée l'onboarding ; ensuite, `etape` ne dépasse jamais la
// progression enregistrée.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ods/Display";
import { Breadcrumb, SteppedProcess } from "@/components/ods/Navigation";
import { matrixOf, overridesFor } from "@/lib/admin/rules";
import { getOnboarding, PlatformRuleError } from "@/lib/data/platform";
import { requirePlatformAdmin } from "@/lib/data/viewer";
import { formatNumber } from "@/lib/format";
import { dict, t } from "@/lib/i18n";
import { roleLabel } from "@/lib/viewer";
import { Facts, OnboardingForm, type OnboardingView } from "./OnboardingForm";

export const metadata: Metadata = { title: dict.onboarding.title };

const o = dict.onboarding;
const a = dict.admin;

type Props = { searchParams: Promise<{ division?: string; etape?: string }> };

export default async function Page({ searchParams }: Props) {
  const viewer = await requirePlatformAdmin();
  const scope = { userId: viewer.userId, role: "PLATFORM_ADMIN" as const };
  const sp = await searchParams;

  let view: OnboardingView;
  if (sp.division) {
    if (!/^[a-z0-9]{1,64}$/i.test(sp.division)) notFound();
    const ob = await getOnboarding(scope, sp.division).catch((e: unknown) => {
      if (e instanceof PlatformRuleError) notFound();
      throw e;
    });
    const asked = Number(sp.etape ?? ob.step);
    const step = Number.isInteger(asked) ? Math.min(Math.max(asked, 1), ob.step) : ob.step;
    const changes = overridesFor(ob.matrix);
    const r = ob.rules;
    view = {
      id: ob.id,
      step,
      identity: ob.identity,
      admin: ob.admin ?? { fullName: "", email: "", config: "COPY" },
      matrix: ob.matrix,
      workflow: ob.workflow,
      rules: ob.rules,
      adminEmail: ob.admin?.email ?? "",
      summary: [
        { n: 1, title: o.steps[0]!, rows: [[o.factName, ob.identity.name], [o.factSlug, ob.identity.slug], [o.factDirection, ob.identity.direction]] },
        {
          n: 2,
          title: o.steps[1]!,
          rows: ob.admin
            ? [[o.factAdmin, ob.admin.fullName], [o.factEmail, ob.admin.email], [o.factConfig, ob.config === "BLANK" ? o.configBlank : o.configCopy]]
            : [],
        },
        {
          n: 3,
          title: o.steps[2]!,
          rows: [
            [o.factPermissions, changes.length ? changes.map((c) => `${roleLabel(c.role)} ${c.granted ? "+" : "−"} ${dict.permissions[c.permission]}`).join(" ; ") : o.noChange],
            [o.factCircuit, ob.workflow.ownerValidation ? o.circuitTwo : o.circuitOne],
            [o.factHr, ob.workflow.hrEmail || "—"],
          ],
        },
        {
          n: 4,
          title: o.steps[3]!,
          rows: [[o.factRules, t(o.rulesSummary, { hours: r.hoursPerDay, step: formatNumber(r.step), deadline: a.deadlineDays[r.deadlineDay as "FRIDAY" | "MONDAY"]?.toLowerCase() ?? r.deadlineDay, time: r.deadlineTime })]],
        },
      ],
    };
  } else {
    view = {
      id: null,
      step: 1,
      identity: { name: "", slug: "", direction: "" },
      admin: { fullName: "", email: "", config: "COPY" },
      matrix: matrixOf([]),
      workflow: { ownerValidation: false, hrAutoSend: true, hrEmail: "", reminderAfterWorkingDays: 3, delegateToOwner: true },
      rules: { unit: "HOURS", workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], hoursPerDay: "8", step: 0.5, deadlineDay: "FRIDAY", deadlineTime: "18:00", fillAlertThreshold: "80", allowFutureWeeks: false, lockAfterValidation: true },
      adminEmail: "",
      summary: [],
    };
  }

  // Colonne de droite : l'étape précédente en résumé, avec son lien de modification.
  const previous = view.step > 1 && view.step < 5 ? view.summary[view.step - 2] : undefined;
  const editLabel = view.step === 2 ? o.editIdentity : view.step === 3 ? o.editAdmin : t(o.editStep, { n: view.step - 1 });

  return (
    <main className="container ts-stack">
      <div className="ts-section" style={{ gap: 20 }}>
        <Breadcrumb items={[{ label: dict.platform.title, href: "/plateforme" }, { label: o.title }]} />
        <h1>{o.title}</h1>
      </div>
      <div className="ts-section" style={{ gap: 10 }}>
        <SteppedProcess steps={[...o.steps]} current={view.step - 1} label={o.stepsLabel} />
        <p className="small">{t(o.stepOf, { n: view.step })}</p>
      </div>
      <div className="ts-split">
        <OnboardingForm key={view.step} view={view} />
        <aside className="ts-section">
          {previous && previous.rows.length > 0 && (
            <section className="card card-muted" aria-labelledby="etape-precedente">
              <h2 className="h5" id="etape-precedente">{t(o.cardTitle, { n: previous.n, title: previous.title })}</h2>
              <Facts rows={previous.rows} />
              <p>
                <Link href={`/plateforme/divisions/nouvelle?division=${view.id}&etape=${previous.n}`} className="fw-bold">{editLabel}</Link>
              </p>
            </section>
          )}
          <Alert tone="info">
            <p>{o.isolated}</p>
          </Alert>
        </aside>
      </div>
    </main>
  );
}
