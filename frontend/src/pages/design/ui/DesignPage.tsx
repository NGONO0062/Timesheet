import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Button, type ButtonVariant } from "@/shared/ui/Button";
import { Accordion, Pills, Popover, Tabs, Tooltip } from "@/shared/ui/Disclosure";
import { Alert, Badge, Card, ListGroup, ListGroupItem, Placeholder, Progress, Spinner, Table, Tag, Toast } from "@/shared/ui/Display";
import { Dropdown } from "@/shared/ui/Dropdown";
import { Checkbox, DateField, InputGroup, InputGroupText, QuantitySelector, Radio, RadioGroup, RequiredLegend, SelectField, Switch, TextareaField, TextField } from "@/shared/ui/Form";
import { Icon } from "@/shared/ui/Icon";
import { Breadcrumb, Pagination, SteppedProcess } from "@/shared/ui/Navigation";
import { Modal, Offcanvas } from "@/shared/ui/Overlay";
import { Wordmark } from "@/shared/ui/Wordmark";

const VARIANTS: Array<[ButtonVariant, string]> = [
  ["primary", "Primaire"],
  ["default", "Secondaire"],
  ["dark", "Sombre"],
  ["success", "Succès"],
  ["danger", "Danger"],
  ["link", "Lien"],
];

const PLANCHES = [
  ["/design/c1", "C1 · Sélecteur de semaine"],
  ["/design/c2-a", "C2 · Saisie par jour, en cours"],
  ["/design/c2-b", "C2 · Saisie par jour, après soumission"],
  ["/design/c3", "C3 · Signature"],
  ["/design/c4", "C4 · Étiquettes de statut"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-20 border-t-2 border-black pt-20">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

/** Composants ODS dans tous leurs états ; les planches C1 à C4 ont leur propre page. */
export function DesignPage() {
  const [modal, setModal] = useState(false);
  const [panel, setPanel] = useState(false);
  const [notify, setNotify] = useState(true);
  const [quantity, setQuantity] = useState("1");
  const [pill, setPill] = useState<"tous" | "attente">("tous");

  return (
    <main className="flex max-w-planche flex-col gap-30 p-30">
      <h1>
        <Wordmark /> · composants
      </h1>
      <nav aria-label="Planches">
        <ul className="flex flex-wrap gap-20">
          {PLANCHES.map(([href, label]) => (
            <li key={href}>
              <Link to={href}>{label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      <Section title="Boutons">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex flex-wrap items-center gap-10">
            {VARIANTS.map(([variant, label]) => (
              <Button key={variant} variant={variant} size={size}>
                {label}
              </Button>
            ))}
            <Button size={size} disabled>
              Désactivé
            </Button>
          </div>
        ))}
      </Section>

      <Section title="Formulaires">
        <RequiredLegend />
        <div className="grid grid-cols-2 gap-20">
          <TextField label="Nom du projet" required placeholder="Ex. Refonte FAQ" hint="Visible par les membres du projet." />
          <TextField label="Adresse e-mail" required defaultValue="aicha" error="Saisissez une adresse e-mail valide." />
          <SelectField label="Rôle">
            <option>Staff</option>
            <option>Manager</option>
          </SelectField>
          <DateField label="Début du stage" />
          <TextField label="Champ désactivé" disabled defaultValue="Lecture seule" />
          <TextareaField label="Commentaire" />
        </div>
        <div className="flex flex-wrap items-start gap-30">
          <Checkbox label="Copier la semaine précédente" defaultChecked hint="Les lignes sont reprises, sans les jours." />
          <Checkbox label="Désactivée" disabled />
          <RadioGroup legend="Mode de signature" required>
            <Radio name="mode" label="Tracé" defaultChecked />
            <Radio name="mode" label="Mot de passe" />
          </RadioGroup>
          <Switch label="Rappel de saisie" checked={notify} onChange={() => setNotify((v) => !v)} />
          <QuantitySelector value={quantity} onChange={setQuantity} step={1} max={1} decreaseLabel="Retirer une journée" increaseLabel="Ajouter une journée" aria-label="Lundi" />
          <InputGroup>
            <input className="h-control rounded-l-md border-2 border-black px-10 font-bold" aria-label="Seuil" defaultValue="80" />
            <InputGroupText>%</InputGroupText>
          </InputGroup>
        </div>
      </Section>

      <Section title="Messages">
        <Alert tone="success" role="status" action={<Button variant="link">Annuler</Button>} onClose={() => undefined}>
          <p>« Refonte FAQ en ligne » est passé à « En cours ».</p>
        </Alert>
        <Alert tone="danger" heading="La fiche n'a pas pu être soumise">
          <p>Le service ne répond pas pour le moment. Rien n&apos;a été modifié : réessayez.</p>
        </Alert>
        <Alert tone="warning">
          <p>Échéance vendredi 12:00.</p>
        </Alert>
        <Alert tone="info">
          <p>Semaine en lecture seule.</p>
        </Alert>
        <Toast tone="success" onClose={() => undefined}>
          Brouillon enregistré.
        </Toast>
      </Section>

      <Section title="Affichage">
        <div className="flex flex-wrap items-center gap-10">
          <Badge>Neutre</Badge>
          <Badge tone="success">Succès</Badge>
          <Badge tone="danger">Danger</Badge>
          <Badge tone="warning">Attention</Badge>
          <Badge tone="info">Info</Badge>
          <Badge dark>Semaine courante</Badge>
          <Tag onRemove={() => undefined} removeLabel="Retirer le filtre Projet">
            Projet : Refonte FAQ
          </Tag>
          <Spinner />
        </div>
        <div className="grid grid-cols-2 gap-20">
          <Card>
            <h3 className="text-h5">Carte</h3>
            <Progress value={62} label="Remplissage" />
            <p className="text-sm">62 %</p>
          </Card>
          <Card muted strong>
            <h3 className="text-h5">Chargement</h3>
            <Placeholder className="w-full" />
            <Placeholder className="w-1/2" />
          </Card>
        </div>
        <ListGroup label="Dernières semaines">
          <ListGroupItem active>Semaine 12</ListGroupItem>
          <ListGroupItem>Semaine 11</ListGroupItem>
        </ListGroup>
        <Table caption="Exemple de tableau">
          <thead>
            <tr>
              <th scope="col">Projet</th>
              <th scope="col">Jours</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Refonte FAQ</th>
              <td>3</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>3</td>
            </tr>
          </tfoot>
        </Table>
      </Section>

      <Section title="Navigation">
        <Breadcrumb items={[{ label: "Projets", href: "/design" }, { label: "Refonte FAQ" }]} />
        <Pagination page={3} pageCount={8} href={(n) => `/design?page=${n}`} />
        <SteppedProcess label="Onboarding" steps={["Identité", "Admin", "Rôles", "Règles", "Fin"]} current={2} />
        <Tabs
          label="Exemple d'onglets"
          tabs={[
            { key: "a", label: "Utilisateurs", content: <p>Liste des utilisateurs.</p> },
            { key: "b", label: "Règles", content: <p>Règles de saisie.</p> },
          ]}
        />
        <Pills label="Filtre" value={pill} onChange={setPill} options={[{ value: "tous", label: "Toutes" }, { value: "attente", label: "En attente" }]} />
        <Accordion
          defaultOpen={["a"]}
          items={[
            { key: "a", title: "Semaine 12", content: <p>Détail de la semaine.</p> },
            { key: "b", title: "Semaine 11", content: <p>Détail de la semaine.</p> },
          ]}
        />
      </Section>

      <Section title="Fenêtres et menus">
        <div className="flex flex-wrap items-center gap-10">
          <Button onClick={() => setModal(true)}>Ouvrir la fenêtre</Button>
          <Button onClick={() => setPanel(true)}>Ouvrir le panneau</Button>
          <Dropdown
            label="Actions"
            buttonClassName="inline-flex min-h-control cursor-pointer items-center gap-10 rounded-md border-2 border-black px-btn-x font-bold hover:bg-black hover:text-white data-open:bg-black data-open:text-white"
            items={[
              { key: "a", content: "Modifier", current: true, currentSuffix: "(actuel)" },
              { key: "b", content: "Archiver" },
            ]}
          >
            Actions <Icon name="down" />
          </Dropdown>
          <Tooltip text="Échéance vendredi 12:00">
            {(p) => (
              <Button {...p} size="sm">
                Info-bulle
              </Button>
            )}
          </Tooltip>
          <Popover title="Aide" button="Aide" buttonClassName="cursor-pointer font-bold underline">
            <p>Une journée par cellule.</p>
          </Popover>
        </div>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Soumettre la semaine 12 ?"
          footer={
            <>
              <Button onClick={() => setModal(false)}>Annuler</Button>
              <Button variant="primary" onClick={() => setModal(false)}>
                Soumettre
              </Button>
            </>
          }
        >
          <p>La fiche passera en lecture seule.</p>
        </Modal>
        <Offcanvas open={panel} onClose={() => setPanel(false)} title="Nouveau projet" footer={<Button variant="primary">Créer le projet</Button>}>
          <TextField label="Nom du projet" required />
        </Offcanvas>
      </Section>
    </main>
  );
}
