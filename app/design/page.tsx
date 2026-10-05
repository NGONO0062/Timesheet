"use client";
// Page /design : chaque composant ODS dans tous ses états, et les liens vers
// les planches des composants spécifiques (C1 à C4) pour comparaison.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Accordion, Alert, Badge, Breadcrumb, Button, ButtonGroup, Card, Checkbox, DateField, Dropdown, Footer, Icon,
  InputGroup, InputGroupText, ListGroup, ListGroupItem, Modal, Navbar, Offcanvas, Pagination, Pills, Placeholder,
  Popover, Progress, QuantitySelector, Radio, RadioGroup, RequiredLegend, SelectField, Spinner, SteppedProcess,
  Switch, Table, Tabs, Tag, TextareaField, TextField, Toast, Tooltip,
} from "@/components/ods";
import { ProjectStatusMenu } from "@/components/ts/StatusBadge";
import { statusChangedMessage } from "@/lib/projects/rules";
import type { ProjectStatus } from "@/lib/status";

const HOVER = { background: "#000000", color: "#ffffff", borderColor: "#000000" };

function Specimen({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <Card>
      <h3 className="h5">{title}</h3>
      {children}
      {note && <p className="small text-secondary">{note}</p>}
    </Card>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ts-specimen-item">
      {children}
      <span className="small">{label}</span>
    </div>
  );
}

export default function DesignPage() {
  const [modal, setModal] = useState(false);
  const [panel, setPanel] = useState(false);
  const [view, setView] = useState<"liste" | "colonnes">("liste");
  const [filter, setFilter] = useState("tous");
  const [qty, setQty] = useState("3");
  const [sw, setSw] = useState(true);
  const [tags, setTags] = useState(["Analyse", "Atelier", "Rédaction"]);
  const [faq, setFaq] = useState<ProjectStatus>("ON_HOLD");
  const [faqPrevious, setFaqPrevious] = useState<ProjectStatus | null>(null);

  return (
    <div className="page page-plain">
      <Navbar href="/design" />
      <main className="container" style={{ display: "flex", flexDirection: "column", gap: 60, padding: "30px 0 60px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h1>Composants</h1>
          <p className="lead">Composants ODS (Boosted) dans tous leurs états, et composants spécifiques TimeSheet. À comparer aux planches de design/ecrans.</p>
        </div>

        <section aria-labelledby="t-specifiques" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <h2 id="t-specifiques">Composants spécifiques</h2>
          <ListGroup>
            {[
              ["/design/c1", "Composant 1 · Sélecteur de semaine", "C1-Selecteur-semaine"],
              ["/design/c2-a", "Composant 2 · Grille : vide, partielle, complète", "C2-Grille-etats-A"],
              ["/design/c2-b", "Composant 2 · Grille : soumise, rejetée, validée", "C2-Grille-etats-B"],
              ["/design/c3", "Composant 3 · Zone de signature électronique", "C3-Signature"],
              ["/design/c4", "Composant 5 · Étiquettes de statut", "C4-Etiquettes-statut"],
            ].map(([href, label, ref]) => (
              <ListGroupItem key={href}>
                <Link href={href!}>{label}</Link>
                <span className="small text-secondary">{ref}</span>
              </ListGroupItem>
            ))}
          </ListGroup>
          <Card>
            <h3 className="h5">Étiquette de projet dans un tableau à défilement</h3>
            <p className="small text-secondary">Le menu est rendu hors du flux : le conteneur à défilement ne le coupe pas. Sans la permission « Gérer les projets », l&apos;étiquette est un simple badge.</p>
            <div className="table-responsive" style={{ maxWidth: 560 }}>
              <table className="table" style={{ minWidth: 720 }}>
                <caption className="visually-hidden">Projets et statut</caption>
                <thead>
                  <tr><th scope="col">Projet</th><th scope="col">Statut</th><th scope="col">Période</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Refonte FAQ en ligne<br /><span className="small text-secondary" style={{ fontWeight: 400 }}>Vue manager</span></th>
                    <td>
                      <ProjectStatusMenu
                        projectName="Refonte FAQ en ligne"
                        value={faq}
                        canManage
                        onChange={(next) => {
                          setFaqPrevious(faq);
                          setFaq(next);
                        }}
                      />
                    </td>
                    <td>2 févr. – 30 avr. 2026</td>
                  </tr>
                  <tr>
                    <th scope="row">Refonte FAQ en ligne<br /><span className="small text-secondary" style={{ fontWeight: 400 }}>Vue collaborateur</span></th>
                    <td><ProjectStatusMenu projectName="Refonte FAQ en ligne" value={faq} canManage={false} onChange={() => undefined} /></td>
                    <td>2 févr. – 30 avr. 2026</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {faqPrevious && (
              <Alert
                tone="success"
                role="status"
                action={<Button variant="link" onClick={() => { setFaq(faqPrevious); setFaqPrevious(null); }}>Annuler</Button>}
              >
                <p>{statusChangedMessage("Refonte FAQ en ligne", faq)}</p>
              </Alert>
            )}
          </Card>
        </section>

        <section aria-labelledby="t-ods" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <h2 id="t-ods">Composants ODS</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 560px), 1fr))", gap: 20, alignItems: "start" }}>
            <Specimen title="Button" note="Survol par inversion, actif en #ff7900, focus en double anneau, désactivé opaque.">
              <div className="ts-specimen">
                <Item label="Défaut"><Button>Enregistrer</Button></Item>
                <Item label="Survol"><Button style={HOVER}>Enregistrer</Button></Item>
                <Item label="Actif"><Button active>Enregistrer</Button></Item>
                <Item label="Focus"><Button className="is-focus">Enregistrer</Button></Item>
                <Item label="Désactivé"><Button disabled>Enregistrer</Button></Item>
              </div>
              <div className="ts-specimen">
                <Item label="Primaire"><Button variant="primary">Soumettre</Button></Item>
                <Item label="Sombre"><Button variant="dark">Exporter</Button></Item>
                <Item label="Succès"><Button variant="success">Valider</Button></Item>
                <Item label="Danger"><Button variant="danger">Rejeter</Button></Item>
                <Item label="Lien"><Button variant="link">Annuler</Button></Item>
              </div>
              <div className="ts-specimen">
                <Item label="Petit (30)"><Button size="sm">Petit</Button></Item>
                <Item label="Moyen (40)"><Button icon="plus">Ajouter une ligne</Button></Item>
                <Item label="Grand (50)"><Button size="lg">Grand</Button></Item>
                <Item label="Icône"><Button iconOnly icon="menu" aria-label="Menu" /></Item>
              </div>
            </Specimen>

            <Specimen title="Button group" note="Le bouton actif porte une coche.">
              <ButtonGroup label="Affichage">
                <Button active={view === "liste"} aria-pressed={view === "liste"} onClick={() => setView("liste")}>Liste</Button>
                <Button active={view === "colonnes"} aria-pressed={view === "colonnes"} onClick={() => setView("colonnes")}>Colonnes</Button>
              </ButtonGroup>
            </Specimen>

            <Specimen title="Input">
              <RequiredLegend />
              <TextField label="Adresse e-mail" required type="email" placeholder="prenom.nom@exemple.com" />
              <TextField label="Champ en erreur" required defaultValue="aicha.ndongo@" error="Saisissez une adresse e-mail complète, par exemple prenom.nom@exemple.com." />
              <TextField label="Champ désactivé" disabled defaultValue="CX Expertise" hint="Géré par l'administrateur de division." />
              <TextField label="Petit (30)" size="sm" defaultValue="Petit" />
              <TextField label="Grand (50)" size="lg" defaultValue="Grand" />
              <DateField label="Date de début" required defaultValue="05/01/2026" />
              <TextareaField label="Motif du rejet" required placeholder="Expliquez ce qui doit être corrigé." />
            </Specimen>

            <Specimen title="Select">
              <SelectField label="Période" defaultValue="fev">
                <option value="fev">Février 2026</option>
                <option value="jan">Janvier 2026</option>
              </SelectField>
              <SelectField label="Rôle" size="sm" defaultValue="m">
                <option value="m">Manager</option>
                <option value="o">Owner</option>
              </SelectField>
              <SelectField label="Désactivé" disabled defaultValue="a">
                <option value="a">Heures</option>
              </SelectField>
            </Specimen>

            <Specimen title="Checkbox et Radio">
              <div className="ts-specimen">
                <Checkbox label="Non cochée" />
                <Checkbox label="Cochée" defaultChecked />
                <Checkbox label="Désactivée" disabled />
              </div>
              <RadioGroup legend="Décision" required>
                <Radio name="decision" label="Valider" defaultChecked />
                <Radio name="decision" label="Rejeter" hint="Le motif devient obligatoire." />
                <Radio name="decision" label="Désactivé" disabled />
              </RadioGroup>
            </Specimen>

            <Specimen title="Switch" note="L'état est écrit à côté.">
              <div className="ts-specimen">
                <Switch label="Rappel de saisie" checked={sw} onChange={(e) => setSw(e.target.checked)} />
                <Switch label="Démonstration désactivé" checked={false} readOnly />
              </div>
            </Specimen>

            <Specimen title="Input group">
              <div>
                <label className="form-label is-required" htmlFor="mdp-demo">Mot de passe</label>
                <InputGroup>
                  <input className="form-control" id="mdp-demo" type="password" aria-required="true" />
                  <Button aria-pressed="false">Afficher</Button>
                </InputGroup>
              </div>
              <div>
                <label className="form-label" htmlFor="budget-demo">Budget</label>
                <InputGroup>
                  <input className="form-control" id="budget-demo" inputMode="decimal" defaultValue="960" />
                  <InputGroupText>h</InputGroupText>
                </InputGroup>
              </div>
            </Specimen>

            <Specimen title="Quantity selector">
              <QuantitySelector value={qty} onChange={setQty} step={0.5} decreaseLabel="Retirer 0,5 h" increaseLabel="Ajouter 0,5 h" aria-label="Heures" />
              <QuantitySelector value={qty} onChange={setQty} step={0.5} size="lg" decreaseLabel="Retirer 0,5 h" increaseLabel="Ajouter 0,5 h" aria-label="Heures (mobile)" />
            </Specimen>

            <Specimen title="Badge" note="Chaque badge coloré porte un glyphe.">
              <div className="ts-specimen">
                <Badge>Neutre</Badge>
                <Badge tone="success">Succès</Badge>
                <Badge tone="danger">Erreur</Badge>
                <Badge tone="warning">Avertissement</Badge>
                <Badge tone="info">Information</Badge>
                <Badge dark>Semaine courante</Badge>
              </div>
            </Specimen>

            <Specimen title="Tag">
              <div className="ts-specimen">
                <Tag>2e soumission</Tag>
                {tags.map((tag) => (
                  <Tag key={tag} removeLabel={`Retirer l'activité ${tag}`} onRemove={() => setTags((ts) => ts.filter((x) => x !== tag))}>{tag}</Tag>
                ))}
              </div>
            </Specimen>

            <Specimen title="Alert">
              <Alert tone="info"><p>Soumise le 20 mars 2026 à 16:42. En attente de validation par Samuel Etoga.</p></Alert>
              <Alert tone="success" role="status" action={<Button variant="link">Annuler</Button>}><p>{statusChangedMessage("Refonte FAQ en ligne", "IN_PROGRESS")}</p></Alert>
              <Alert tone="warning" heading="Semaine 11 non saisie"><p>L&apos;échéance est dépassée.</p></Alert>
              <Alert tone="danger" heading="Les fiches n'ont pas pu être chargées" action={<Button>Réessayer</Button>}>
                <p>Vos saisies sont conservées. Réessayez dans un instant.</p>
              </Alert>
            </Specimen>

            <Specimen title="Toast">
              <Toast tone="success" onClose={() => undefined}><p>Fiche validée.</p></Toast>
            </Specimen>

            <Specimen title="Card">
              <Card as="div"><p>Bordure discrète #999999.</p></Card>
              <Card as="div" strong><p>Bordure forte noire.</p></Card>
              <Card as="div" muted><p>Surface tertiaire #fafafa.</p></Card>
            </Specimen>

            <Specimen title="List group">
              <ListGroup label="Heures par jour">
                <ListGroupItem><span>Lun 16</span><span className="fw-bold">8 h</span></ListGroupItem>
                <ListGroupItem active><span>Mar 17 (actif)</span><span className="fw-bold">8 h</span></ListGroupItem>
                <ListGroupItem><span>Mer 18</span><span className="fw-bold">4 h</span></ListGroupItem>
              </ListGroup>
            </Specimen>

            <Specimen title="Table" note="Survol de ligne en #dddddd.">
              <Table caption="Dernières semaines">
                <thead>
                  <tr><th scope="col">Semaine</th><th scope="col">Période</th><th scope="col" className="num">Heures</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">S12</th><td>16–20 mars</td><td className="num">24 h</td></tr>
                  <tr><th scope="row">S11</th><td>9–13 mars</td><td className="num">0 h</td></tr>
                  <tr style={{ background: "#dddddd" }}><th scope="row">S10 (survol)</th><td>2–6 mars</td><td className="num">40 h</td></tr>
                </tbody>
                <tfoot>
                  <tr><th scope="row">Total</th><td /><td className="num">64 h</td></tr>
                </tfoot>
              </Table>
            </Specimen>

            <Specimen title="Tabs et Pills">
              <Pills
                label="Filtrer par statut"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "tous", label: "Tous (7)" },
                  { value: "cours", label: "En cours (4)" },
                  { value: "pause", label: "En pause (1)" },
                ]}
              />
              <Tabs
                label="Volets"
                tabs={[
                  { key: "a", label: "Fiches", content: <p>Contenu du premier onglet.</p> },
                  { key: "b", label: "Fiches de présence à signer", content: <p>Contenu du second onglet.</p> },
                ]}
              />
            </Specimen>

            <Specimen title="Breadcrumb et Pagination">
              <Breadcrumb items={[{ label: "Tableau de bord", href: "/design" }, { label: "Saisie hebdomadaire" }]} />
              <Pagination page={1} pageCount={5} href={(n) => `/design?page=${n}`} />
            </Specimen>

            <Specimen title="Progress" note="La valeur est toujours écrite à côté de la barre.">
              <p className="fw-bold">24 h sur 40 h · 60 %</p>
              <Progress value={60} label="Avancement de la saisie de la semaine" />
              <p className="fw-bold">Budget dépassé de 10 h</p>
              <Progress value={100} tone="danger" label="Budget consommé" />
            </Specimen>

            <Specimen title="Spinner et Placeholder" note="Aplat #dddddd plein, battement coupé sous prefers-reduced-motion.">
              <Spinner />
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: 380 }}>
                <Placeholder width={80} />
                <Placeholder height={40} radius={6} />
              </div>
            </Specimen>

            <Specimen title="Stepped process">
              <SteppedProcess label="Circuit de la fiche de présence" current={1} steps={["Fiche générée", "Votre signature", "Signature du superviseur", "E-mail aux RH"]} />
            </Specimen>

            <Specimen title="Dropdown">
              <div style={{ minHeight: 190 }}>
                <Dropdown
                  label="Exporter"
                  items={[
                    { key: "csv", content: <span>CSV</span> },
                    { key: "xlsx", content: <span>Excel</span> },
                    { key: "pdf", content: <span>PDF</span> },
                  ]}
                  trigger={(p) => (
                    <button className="btn" type="button" {...p}>
                      Exporter
                      <Icon name="down" />
                    </button>
                  )}
                />
              </div>
            </Specimen>

            <Specimen title="Tooltip et Popover">
              <div className="ts-specimen" style={{ paddingTop: 30, minHeight: 200 }}>
                <Tooltip text="Heures saisies sur heures attendues">
                  {(p) => <Button {...p}>Survolez-moi</Button>}
                </Tooltip>
                <Popover title="Taux de remplissage" trigger={(p) => <Button {...p}>Ouvrir l&apos;aide</Button>}>
                  <p>Heures saisies divisées par la capacité de l&apos;équipe sur la période.</p>
                </Popover>
              </div>
            </Specimen>

            <Specimen title="Accordion">
              <Accordion
                defaultOpen={["a"]}
                items={[
                  { key: "a", title: "Historique", content: <p>Soumise le 20 mars 2026 à 16:42.</p> },
                  { key: "b", title: "Commentaire du collaborateur", content: <p>Atelier déplacé au jeudi.</p> },
                ]}
              />
            </Specimen>

            <Specimen title="Modal et Offcanvas" note="Focus piégé, Échap ferme, le focus revient sur le déclencheur.">
              <div className="ts-specimen">
                <Button onClick={() => setModal(true)}>Ouvrir la modale</Button>
                <Button onClick={() => setPanel(true)}>Ouvrir le panneau</Button>
              </div>
              <Modal
                open={modal}
                onClose={() => setModal(false)}
                title="Soumettre la semaine 12 ?"
                footer={
                  <>
                    <Button onClick={() => setModal(false)}>Annuler</Button>
                    <Button variant="primary" onClick={() => setModal(false)}>Confirmer la soumission</Button>
                  </>
                }
              >
                <p>Vérifiez le récapitulatif avant d&apos;envoyer votre fiche à votre manager.</p>
              </Modal>
              <Offcanvas
                open={panel}
                onClose={() => setPanel(false)}
                title="Nouveau projet"
                closeLabel="Fermer le panneau"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPanel(false);
                }}
                footer={
                  <>
                    <Button onClick={() => setPanel(false)}>Annuler</Button>
                    <Button variant="primary" type="submit">Créer le projet</Button>
                  </>
                }
              >
                <RequiredLegend />
                <TextField label="Nom du projet" required defaultValue="Audit parcours réclamation" />
              </Offcanvas>
            </Specimen>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
