# TimeSheet — prompt de développement pour Claude Code

Tu vas coder **TimeSheet**, une application web interne d'Orange Cameroun pour gérer les projets et les temps de travail. Les maquettes sont terminées et validées. Elles se trouvent dans le dossier `design/` du dépôt. Ton travail consiste à livrer l'application qui leur correspond, écran par écran, sans réinterpréter le design.

Lis ce document en entier, puis `design/README.md`, avant d'écrire la première ligne de code.

---

## 1. Le produit

- Application multi-division : chaque division est un tenant isolé (utilisateurs, rôles, projets, règles, données).
- Division pilote : **CX Expertise**. Rattachement : Direction **DEC**, Département **CX**, Service **CX Expertise**.
- Les collaborateurs saisissent leurs heures par projet et par jour, semaine par semaine. Le manager valide ou rejette. Chaque mois, l'application produit la fiche de présence du stagiaire au modèle RH **OCM/PS-01/SE/049**, la fait signer, puis l'envoie **par e-mail** aux RH avec le PDF en pièce jointe.
- Interface en français. Desktop d'abord (1280 px), mobile pris en charge (375 px).
- Nom affiché : le mot **TimeSheet**, « Time » en `#f16e00` et « Sheet » en blanc sur fond noir. Il n'y a pas de logo. N'en dessine pas, et n'utilise pas le logo Orange.

## 2. Ce que contient `design/`

| Chemin | Contenu |
|---|---|
| `design/ods.css` | Feuille de style de la maquette. Elle applique les tokens du design system avec les noms de classes Boosted, plus les composants spécifiques préfixés `.ts-`. C'est la référence visuelle. |
| `design/ecrans/*.html` | Les 30 planches en HTML statique. Ouvre-les dans un navigateur : c'est le rendu attendu, au pixel. |
| `design/captures/*.png` | Captures des mêmes planches. |
| `design/prototype/*.dc.html` | Sources du prototype pour les 5 écrans à logique (03, 06, 07, 08, 09). Le bloc `<script>` en bas de chaque fichier contient les règles de calcul et les transitions d'état. Le moteur de rendu est propre à l'outil de maquettage : reprends la logique, pas la syntaxe. |
| `design/README.md` | Index des planches, note de composants par écran, hypothèses. |
| `CLAUDE.md` (racine) | Rappel court des règles à respecter à chaque session. Complète-le avec les commandes du projet dès le jalon 0. |

Quand ce document et une maquette se contredisent sur un point visuel, la maquette a raison. Sur une règle métier, c'est ce document qui a raison.

## 3. Stack

Valeurs par défaut. Si l'une d'elles pose un problème, dis-le avant de commencer au lieu de la changer en silence.

- **Next.js** (App Router) + **React** + **TypeScript** strict.
- **Styles** : paquet npm `boosted` (5.3.x), l'implémentation officielle d'ODS Web, comme base. Par-dessus, une couche `timesheet.css` qui porte les composants `.ts-*` et les écarts listés au §4.3, reprise de `design/ods.css`. Pas de Tailwind, pas de shadcn/ui, pas de MUI, pas de CSS-in-JS.
- **Comportements** (Modal, Offcanvas, Dropdown, Tabs) : codés en composants React accessibles. N'importe pas le JavaScript de Boosted, il manipule le DOM dans le dos de React.
- **Base de données** : PostgreSQL + Prisma.
- **Authentification** : Auth.js, fournisseur e-mail + mot de passe (argon2), sessions en base. L'architecture doit permettre d'ajouter un SSO plus tard sans réécrire les permissions.
- **PDF** : un seul gabarit HTML/CSS pour l'aperçu à l'écran et pour le PDF, imprimé côté serveur avec Chromium (Playwright). Si l'hébergement interdit Chromium, propose `@react-pdf/renderer` et dis ce que ça coûte en fidélité.
- **E-mail** : Nodemailer en SMTP, configuration par variables d'environnement. En développement, Mailpit.
- **Tests** : Vitest (règles métier), Playwright (parcours), `@axe-core/playwright` (accessibilité).
- **Police** : pile `"Helvetica Neue", Helvetica, Arial, sans-serif`. Helvetica Neue est sous licence : n'embarque aucun fichier de police dans le dépôt. Les fichiers seront fournis par l'équipe de marque.
- **Icônes** : un composant `<Icon name="…" />` unique. Les icônes officielles sont les Solaris d'Orange, réservées aux projets Orange et non libres. La maquette utilise des tracés génériques en attendant. Garde ces tracés derrière le composant pour qu'on puisse les remplacer d'un coup quand les SVG officiels seront fournis.

## 4. Design system

### 4.1 Tokens (non négociables)

**Couleurs.** Ces douze valeurs pour toute l'interface. Seule exception : les quatre couleurs de séries des graphiques (§4.3, point 6).

| Token | Valeur | Usage |
|---|---|---|
| Orange de marque | `#ff7900` | État actif uniquement : bouton pressé, pill active, case cochée |
| Orange d'interface | `#f16e00` | Bouton primaire, survol de lien, barre de progression, marqueur requis |
| Noir | `#000000` | Texte, bordures fortes |
| Blanc | `#ffffff` | Fond |
| Gris | `#999999` | Bordure discrète, contenu désactivé |
| Gris foncé | `#595959` | Texte secondaire, placeholder |
| Gris clair | `#dddddd` | Surface secondaire, survol discret |
| Gris très clair | `#fafafa` | Surface tertiaire |
| Succès | `#228722` | |
| Erreur | `#cd3c14` | |
| Avertissement | `#ffd200` | |
| Information | `#4170d8` | |

**Typographie.** Graisses 400 et 700 seulement.

| Style | Taille / interligne | Approche |
|---|---|---|
| H1 | 34 / 34 | −1 px |
| H2 | 30 / 32 | −0,8 px |
| H3 | 24 / 26 | −0,5 px |
| H4 | 20 / 22 | −0,4 px |
| H5 | 18 / 20 | −0,2 px |
| H6 | 16 / 18 | −0,1 px |
| Corps | 16 / 18 | |
| Petit | 14 / 16 | |
| Grand | 18 / 30 | |

En 700 : titres, labels de formulaire, texte des boutons, liens de navigation, valeurs de champs.

**Espacement.** Base 20 px. Échelle : 0, 5, 10, 20, 30, 60. Rien d'autre (seule exception : le padding interne des contrôles, fixé par le composant).

**Grille.** 12 colonnes, gouttière 20 px. Points de rupture 0 / 480 / 768 / 1024 / 1280 / 1440. Conteneurs 312 / 468 / 744 / 960 / 1200 / 1320.

**Bordures.** 2 px, jamais 1 px. Noire pour une bordure forte, `#999999` pour une bordure discrète. Rayon 6 px (petit 4, grand 8). Aucune ombre.

**États.**
- Survol : inversion de contraste (fond noir, texte blanc).
- Actif : fond `#ff7900`, texte noir.
- Focus : double anneau, contour noir 3 px et anneau blanc 2 px à l'intérieur.
- Désactivé : opaque. Bouton fond `#999999` texte blanc ; champ fond `#dddddd` texte `#595959`. Jamais d'opacité réduite.

**Contrôles.** Hauteurs 30 / 40 / 50 px. Bouton par défaut : padding 8 × 18 px, 16 px gras. Case à cocher carrée (rayon 0), radio ronde. Marqueur de champ requis : astérisque `#f16e00` à droite du label.

### 4.2 Interdits

Ombres. Bordures de 1 px. Graisses 500 ou 600. Survol qui éclaircit. Désactivé par opacité. Espacements hors échelle ou grille de 8 pt. Dégradés. Rayons au-dessus de 8 px. Réinventer un composant qui existe dans ODS.

Ajoute une règle stylelint (ou un script de contrôle lancé en CI) qui échoue sur : `border*: 1px`, `font-weight` autre que 400/700, `opacity` autre que 0 ou 1, `gradient(`, `box-shadow` hors anneau de focus, `border-radius` > 8 px, couleur hors palette (les quatre couleurs de séries ne sont admises que dans les règles `.chart-s1` à `.chart-s4`).

### 4.3 Écarts assumés par rapport à Boosted

Ils sont dans `design/ods.css`. Reporte-les dans `timesheet.css` et documente-les dans `docs/ecarts-ods.md`.

1. **Champs de saisie** : bordure noire et non `#999999`. Le gris fait 2,85:1 sur blanc, sous le 3:1 exigé pour un composant d'interface. `#999999` reste réservé aux séparateurs.
2. **Placeholder de chargement** : aplat `#dddddd` plein avec un battement de couleur, coupé sous `prefers-reduced-motion`. Celui de Boosted repose sur l'opacité et un dégradé, deux interdits.
3. **Pill active** : une coche précède le libellé. `#ff7900` sur blanc fait 2,6:1, la couleur seule ne suffit pas.
4. **Badges de statut** : chaque badge coloré porte un glyphe (coche, croix, « ! », « i ») en plus du libellé.
5. **Voile de modale et d'offcanvas** : noir à 50 %, comme Boosted. C'est la seule transparence de l'application.
6. **Graphiques** : ODS Web n'a pas de composant graphique, et les douze couleurs du brief n'ont pas de couleurs de séries. Les graphiques prennent quatre teintes des rampes ODS livrées dans Boosted, dans cet ordre fixe : bleu `#237eca` (`$ods-blue-500`), vert `#198c51` (`$ods-green-500`), violet `#6e4aa7` (`$ods-purple-500`), rose `#d573bb` (`$ods-pink-500`). Elles ne servent qu'aux marques des graphiques, jamais au texte ni aux composants. Règles :
   - la couleur suit l'entité (le projet, la personne), pas son rang : un filtre ne doit pas repeindre les séries restantes ;
   - une seule série = une seule couleur, la première (bleu) ;
   - au-delà de quatre séries, regroupe le reste dans « Autres » ou passe en petits multiples, n'invente pas de cinquième teinte ;
   - les couleurs de statut (succès, erreur, avertissement, information) ne sont jamais des couleurs de séries ;
   - légende dès qu'il y a deux séries, valeurs écrites en noir, tableau de données sous le graphique, infobulle par marque au survol et au focus ;
   - segments empilés séparés par un filet blanc de 2 px ; colonne évidée (fond blanc, contour de la couleur) pour une période en cours ;
   - aucune bibliothèque de graphiques : barres et colonnes en HTML et CSS (classes `.chart-*` de `design/ods.css`).
7. **Dates** : ODS Web n'a pas de sélecteur de date. Saisie texte `jj/mm/aaaa` avec le format rappelé sous le champ.
8. **Navigation latérale** : ODS Web n'a pas de barre latérale. Elle est assemblée avec le Nav vertical, sur fond noir.

Si un rendu par défaut de Boosted contredit un token du §4.1, le token gagne : corrige dans `timesheet.css` et ajoute une ligne à `docs/ecarts-ods.md`.

### 4.4 Composants ODS à utiliser tels quels

Button, Input, Select, Checkbox, Radio, Switch, Input group, Card, Table, List group, Badge, Tag, Alert, Toast, Modal, Tooltip, Popover, Progress, Spinner, Placeholder, Accordion, Tabs, Breadcrumb, Pagination, Dropdown, Button group, Offcanvas, Stepped process, Navbar (sans logo), Footer, Quantity selector.

Crée un composant React par composant ODS dans `components/ods/`, avec le balisage et les classes Boosted. `design/README.md` liste, écran par écran, ceux qui sont utilisés.

## 5. Principes d'expérience

L'application doit se comprendre sans mode d'emploi. Ces règles s'appliquent à chaque écran, y compris ceux qui ne sont pas maquettés.

1. **Ce qu'il faut faire d'abord.** Chaque page d'accueil commence par les actions en attente de l'utilisateur, avec un bouton par action.
2. **Un seul bouton primaire par écran.** Les autres actions sont des boutons par défaut ou des liens.
3. **Un objet, une étiquette.** Les statuts viennent tous de la planche `C4-Etiquettes-statut`, avec le même libellé partout : listes, détails, e-mails, exports.
4. **Annuler plutôt que confirmer.** Une action réversible s'applique tout de suite, avec un message qui propose « Annuler ». La fenêtre de confirmation est réservée à ce qui engage : soumettre une semaine, signer, rejeter.
5. **Dire pourquoi.** Un bouton désactivé a sa raison écrite à côté. Un message d'erreur dit ce qui s'est passé, ce qui est conservé et quoi faire.
6. **Jamais d'impasse.** Un écran vide explique pourquoi il est vide et propose l'action suivante.
7. **Des mots simples.** Pas de jargon technique dans l'interface : « Semaine 11 non saisie », pas « Timesheet manquante ».
8. **Le détail à la demande.** Les formulaires longs s'ouvrent dans un panneau, les réglages rares restent dans l'écran de modification.
9. **Une réponse immédiate.** Chaque action affiche son résultat sans rechargement de page, annoncé dans une zone de statut.

## 6. Structure de l'interface

**Connexion.** La seule page sans navigation. Deux volets (`.ts-login`) : à gauche, sur fond noir, le mot TimeSheet, une phrase et les trois étapes de l'application (Saisir, Soumettre, Signer) ; à droite, le formulaire seul, centré, large de 400 px au plus, en contrôles de 50 px. Le noir du volet est celui de la barre latérale qu'on retrouve après la connexion. Sur mobile, le volet devient un bandeau en tête et les trois étapes disparaissent. Comportement :

- bouton « Afficher / Masquer » sur le mot de passe ;
- champ vide à l'envoi : message sous le champ concerné, focus sur le premier champ en erreur ;
- identifiants incorrects : une alerte au-dessus du formulaire qui ne dit pas lequel des deux est faux, l'adresse e-mail reste saisie, le mot de passe est vidé ;
- « Première connexion ? » explique que le compte vient d'une invitation de l'administrateur de division.

**Desktop.** Barre latérale noire à gauche, 240 px, collante sur toute la hauteur. De haut en bas : le mot TimeSheet et le nom de la division, les liens du rôle avec icône, puis en bas de colonne le bloc utilisateur (initiales, nom, rôle), Paramètres et Se déconnecter. Lien courant : fond `#ff7900`, texte noir, `aria-current="page"`. Le contenu occupe le reste, dans un conteneur de 1200 px maximum, avec le pied de page en bas.

**Mobile.** Barre noire en haut avec le mot TimeSheet et un bouton menu de 50 px qui ouvre la navigation dans un Offcanvas.

**Liens par rôle.**

| Rôle | Liens |
|---|---|
| Staff | Tableau de bord, Saisie hebdomadaire, Fiche de présence |
| Manager | Validation, Projets, Reporting |
| Owner | Vue division, Validation, Projets, Reporting |
| Admin division | Administration, Reporting |
| Admin plateforme | Divisions, Journal d'audit |

La navigation se calcule à partir des permissions effectives de l'utilisateur, pas du nom de son rôle. Un manager qui a la permission de saisir ses temps voit aussi les trois liens Staff.

## 7. Rôles et permissions

Cinq rôles : `STAFF` (stagiaires compris), `MANAGER` (N+1), `OWNER` (N+2), `DIVISION_ADMIN`, `PLATFORM_ADMIN`.

Matrice par défaut. Elle est modifiable par division sur l'écran 12.

| Permission | Staff | Manager | Owner | Admin division |
|---|:-:|:-:|:-:|:-:|
| Saisir et soumettre ses temps | oui | oui | | |
| Valider les fiches de son équipe | | oui | oui | |
| Gérer les projets : création, statut, membres | | oui | oui | oui |
| Consulter le reporting | | oui | oui | oui |
| Voir la vue consolidée de la division | | | oui | oui |
| Gérer les utilisateurs, workflows et règles | | | | oui (verrouillée) |

- La dernière permission de l'admin de division ne peut pas être retirée.
- L'admin plateforme gère les divisions et lit le journal d'audit. Il ne voit pas les fiches de temps.
- Portée des données : un manager voit ses rattachés directs ; un owner voit toute sa division ; personne ne voit une autre division.
- Chaque vérification se fait côté serveur, dans une couche d'accès aux données unique qui exige `divisionId` et le rôle. Aucune requête Prisma en dehors de cette couche.

## 8. Modèle de données

Proposition de départ. Ajuste les détails, garde les invariants.

```
Division            id, name, slug, direction, status (ACTIVE | ONBOARDING | SUSPENDED),
                    onboardingStep, createdAt
DivisionSettings    divisionId, unit (HOURS | DAYS), workingDays[], hoursPerDay (8),
                    step (0.5), deadlineDay (FRIDAY), deadlineTime ("18:00"),
                    fillAlertThreshold (80), allowFutureWeeks (false),
                    lockAfterValidation (true), ownerValidation (false),
                    hrEmail, hrAutoSend (true), reminderAfterWorkingDays (3),
                    delegateToOwner (true)
RolePermission      divisionId, role, permission, granted
Team                id, divisionId, name, managerId
User                id, divisionId (null pour l'admin plateforme), email, passwordHash,
                    firstName, lastName, role, managerId, teamId, active,
                    usualArrival ("08:00"), usualDeparture ("17:00"),
                    locale, defaultSignatureMode, copyPreviousWeek, notificationPrefs
Internship          userId, kind (ACADEMIC | PROFESSIONAL | GRADUATE),
                    direction, department, service, startDate, endDate
Project             id, divisionId, code, name, startDate, endDate?, budgetHours?,
                    status (NOT_STARTED | IN_PROGRESS | ON_HOLD | DONE), statusChangedAt,
                    statusChangedById, archivedAt?
Activity            id, projectId, name
ProjectMember       projectId, userId
Timesheet           id, divisionId, userId, isoYear, isoWeek,
                    status (DRAFT | SUBMITTED | REJECTED | VALIDATED),
                    comment, submittedAt, submissionCount, decidedById, decidedAt,
                    rejectionReason   — unique (userId, isoYear, isoWeek)
TimesheetLine       id, timesheetId, projectId, activityId, position
TimeEntry           lineId, date, hours (Decimal), flagged
TimesheetEvent      timesheetId, type, actorId, at, note
AttendanceSheet     id, divisionId, userId, year, month,
                    status (GENERATED | SIGNED_BY_INTERN | SIGNED_BY_SUPERVISOR | SENT),
                    generatedAt, absenceDays, observation, pdfPath, pdfSha256, sentAt, sentTo
Signature           id, attendanceSheetId, signerId, signerRole, method (DRAWN | PASSWORD),
                    drawing, signedAt, documentSha256, ip, userAgent
AuditLog            id, at, actorId?, actorLabel, divisionId?, action, objectLabel,
                    result (SUCCESS | FAILURE), metadata   — en ajout seul
```

- Toute table métier porte `divisionId`.
- « Manquante » n'est pas un statut stocké. C'est un état calculé : échéance passée, fiche absente ou encore en brouillon.
- `AuditLog` : aucune route ne modifie ni ne supprime une ligne.

## 9. Règles métier

### 9.1 Tableau de bord (staff)

L'écran se lit de haut en bas, du plus urgent au moins urgent.

- **À faire** : la liste des actions en attente, chacune avec son bouton. Une ligne par semaine manquante (« Semaine 11 non saisie », bouton « Saisir la semaine 11 »), une ligne par fiche de présence à signer (bouton « Signer ma fiche »), une ligne par fiche rejetée à corriger. Le compte est écrit à côté du titre. Sans action : « Rien à faire pour l'instant. »
- **Semaine en cours** : statut, sélecteur de semaine, heures saisies sur heures attendues, barre de progression avec le pourcentage écrit, statut de chaque jour, échéance. Elle porte le seul bouton primaire de l'écran, « Continuer la saisie ».
- **Mes projets** : les projets dont l'utilisateur est membre, sauf les projets terminés. Pour chacun : code, date de fin ou de début, étiquette de statut, activités, heures de la semaine. Un projet qui n'est pas « En cours » affiche « Saisie pas encore ouverte » ou « Saisie fermée » à la place des heures.
- **Dernières semaines** : les quatre dernières, avec période, heures, statut et action (Continuer, Saisir, Consulter).

### 9.2 Saisie hebdomadaire

- Semaines ISO, du lundi au vendredi (jours ouvrés réglables par division). Fuseau `Africa/Douala`.
- Unité : l'heure. 8 h attendues par jour, 40 h par semaine, pas de 0,5 h. Ces trois valeurs viennent de `DivisionSettings`, ne les écris jamais en dur.
- Une ligne = un projet + une activité. On ne peut ajouter que les projets auxquels on est affecté, qui couvrent la semaine et dont le statut est « En cours ».
- Une cellule accepte un nombre positif, multiple du pas, avec la virgule comme séparateur décimal.
- Statut de chaque jour, affiché en badge sous le total : `À saisir` (0 h), `Incomplet` (entre 0 et 8), `Complet` (8), `Dépassement` (plus de 8, en erreur).
- Le bouton Soumettre n'est actif que si chaque jour ouvré totalise exactement les heures attendues. Quand il est inactif, la raison est écrite à côté (« Il reste 16 h à saisir : jeudi 19 et vendredi 20 mars. »).
- Sauvegarde automatique du brouillon, environ une seconde après la dernière frappe. Une zone `role="status"` annonce « Brouillon enregistré automatiquement à 10:42 ». Si l'enregistrement échoue : « Brouillon non enregistré », et la saisie reste à l'écran.
- La soumission passe par une modale de confirmation : période, validateur, heures par projet, total.
- Une fois soumise, la fiche est en lecture seule. Les valeurs s'affichent en texte, pas en champs désactivés.
- Si la division interdit la saisie future, la flèche « semaine suivante » est désactivée sur la semaine courante.
- Semaine vide : état vide avec « Ajouter une ligne » et « Reprendre les lignes de la semaine précédente ».

### 9.3 Validation

- File du manager : fiches soumises par ses rattachés. Filtres Personne et Période. Onglets En attente, Validées, Rejetées, Toutes, chacun avec son compte.
- Sélection multiple. La barre d'actions groupées n'apparaît que s'il y a une sélection. Validation groupée directe ; rejet groupé dans une modale avec un motif commun obligatoire.
- Détail d'une fiche : grille en lecture seule, commentaire du collaborateur, historique, formulaire de décision (radio Valider / Rejeter). Le motif n'apparaît et n'est requis que pour un rejet. Liens Précédente / Suivante, « Fiche 1 sur 6 ».
- Rejet : la fiche passe en `REJECTED`, redevient modifiable, et le collaborateur voit le motif en bandeau. Le manager peut signaler une ou plusieurs cellules ; elles apparaissent en erreur chez le collaborateur, reliées au message par `aria-describedby`, et le jour concerné porte le badge « À corriger ».
- Nouvelle soumission : `submissionCount` augmente et la file affiche le tag « 2e soumission ».
- Validation : la fiche passe en `VALIDATED` et se verrouille (si la règle de la division le demande).
- Validation N+2 facultative, désactivée par défaut. Délégation au N+2 quand le manager est absent, activée par défaut.
- Relance automatique du validateur après 3 jours ouvrés sans décision.
- Chaque changement de statut crée un `TimesheetEvent` et une ligne d'`AuditLog`.

### 9.4 Projets

- Champs : nom, code (du type `CX-2026-01`), dates de début et de fin, statut, budget d'heures facultatif, activités, membres.
- **Statut**, porté par une étiquette (planche `C4-Etiquettes-statut`) :

  | Statut | Valeur | Saisie des temps |
  |---|---|---|
  | À démarrer | `NOT_STARTED` | Fermée. Statut par défaut à la création |
  | En cours | `IN_PROGRESS` | Ouverte aux membres |
  | En pause | `ON_HOLD` | Fermée, les heures déjà saisies sont conservées |
  | Terminé | `DONE` | Fermée, le projet reste dans le reporting |

- Tous les passages d'un statut à l'autre sont permis. Seuls les rôles qui ont la permission « Gérer les projets » changent le statut. Pour eux l'étiquette est un bouton qui ouvre un Dropdown des quatre statuts, le statut actuel coché. Pour les autres c'est un simple Badge.
- Le changement est immédiat, sans fenêtre de confirmation. Un message de statut le confirme, dit l'effet sur la saisie et propose « Annuler ». Chaque changement crée une ligne d'`AuditLog`.
- Quand un projet quitte « En cours », les lignes déjà présentes dans les brouillons de la semaine restent visibles en lecture seule, avec les heures déjà saisies. On ne peut plus y ajouter d'heures.
- Le statut ne change jamais tout seul. Si la date de fin est passée et que le projet est encore « En cours », la ligne affiche « Date de fin dépassée » et laisse le manager décider.
- Heures consommées : somme des heures des fiches soumises ou validées, sur le budget, avec une barre. Au-delà de 100 %, la barre passe en rouge et un texte dit « Budget dépassé de 10 h ». Le budget n'a pas d'étiquette : une ligne ne porte qu'une étiquette, le statut.
- Deux affichages, par un Button group « Liste / Colonnes » :
  - **Liste** : tableau filtrable par statut (pills « Tous », « En cours », « À démarrer », « En pause », « Terminés », chacune avec son compte). Tri par statut puis par code.
  - **Colonnes** : une colonne par statut, une carte par projet. Pas de glisser-déposer : le statut se change par l'étiquette, au clavier comme à la souris. Sous 1024 px, seul l'affichage en liste est proposé. Le choix d'affichage est gardé dans l'URL (`?vue=colonnes`).
- Les projets archivés sont masqués. Un interrupteur « Afficher les projets archivés » les fait réapparaître. L'archivage se fait depuis le panneau de modification.
- La création et la modification se font dans un Offcanvas à droite, la liste reste visible derrière.

### 9.5 Reporting (manager)

- Axe d'analyse : Projet, Personne ou Activité. Période de semaine à semaine. Périmètre : toute l'équipe ou une personne.
- Indicateurs : heures saisies sur la capacité (personnes × semaines × heures hebdomadaires), taux de remplissage, fiches validées sur le total attendu.
- Heures par projet en barres, une couleur par projet. Heures par semaine en colonnes empilées par projet, avec les mêmes couleurs, le total écrit au-dessus et une légende (colonne évidée pour la semaine en cours de validation). Tableau de détail avec la part de chaque projet.
- Export CSV, Excel, PDF.

### 9.6 Vue consolidée (owner)

- Par semaine : taux de remplissage, fiches soumises, fiches validées, nombre de dérives.
- Tableau par équipe, avec alerte sous le seuil de remplissage de la division (80 %).
- Tendance sur six semaines, en colonnes d'une seule couleur (bleu des graphiques), colonne évidée pour la semaine en cours.
- Dérives : budget dépassé, sous-remplissage, validation en retard (plus de 3 jours), saisie manquante. Chaque dérive a une action : voir le projet, voir l'équipe, relancer par e-mail.

### 9.7 Fiche de présence RH

- Modèle papier : **FICHE DE PRESENCE STAGIAIRE**, référence **OCM/PS-01/SE/049**, A4 paysage, une page. Le gabarit est déjà intégré : `design/ecrans/06-Fiche-RH.html`, classes `.ts-sheet*`.
- Une fiche par stagiaire et par mois, générée quand toutes les semaines du mois sont validées.
- Contenu :
  - en-tête : titre, référence, « Version : 1.0 », « Mise à jour le : 15/06/2023 » ;
  - NOM ET PRENOM DU STAGIAIRE ;
  - NATURE DU STAGE : Académique, Professionnel ou Graduate (une case cochée) ;
  - ENTITE D'AFFECTATION : Direction, Département, Service ;
  - PERIODE DE STAGE : Du … Au … ;
  - six blocs de semaine, chacun avec lundi à vendredi et les colonnes Arrivée et Départ ; les blocs non utilisés restent en pointillés ;
  - Nombre de jours d'absence, Observation, Nom et signature du superviseur ;
  - pied : « Interne Orange Cameroun », « Page 1/1 ».
- Arrivée et Départ : la grille de saisie ne les collecte pas. Ils viennent des horaires habituels du stagiaire (écran Paramètres, 08:00 et 17:00 par défaut), pour chaque jour où il a saisi des heures.
- Circuit, affiché en Stepped process : Fiche générée → Votre signature → Signature du superviseur → E-mail aux RH.
- Le modèle papier ne prévoit que la signature du superviseur. Celle du stagiaire certifie la fiche dans l'application, reste dans l'historique et n'est pas imprimée sur le PDF. Celle du superviseur est imprimée dans la case prévue.
- Après la signature du superviseur, le PDF est envoyé par e-mail à l'adresse RH de la division. L'envoi est automatique si le réglage est activé, sinon il se fait par un bouton. L'écran montre le canal, le destinataire, la pièce jointe et l'état.
- Nom du fichier : `Fiche_presence_AAAA-MM_NOM.pdf`.
- La case logo du modèle papier reste vide tant que le fichier officiel n'est pas fourni.

### 9.8 Signature électronique

- Deux modes : tracé (souris, doigt, stylet) et validation par mot de passe. Le second existe pour le clavier et les lecteurs d'écran : il doit toujours être proposé.
- Avant de signer, une case « Je certifie l'exactitude des informations de cette fiche de présence » doit être cochée.
- Bloc de traçabilité toujours visible : signataire et rôle, date, heure (UTC+1), méthode, document. Après signature s'ajoute l'empreinte SHA-256 du PDF signé.
- Une signature posée ne se modifie plus. Elle n'est annulée que si le superviseur rejette la fiche.
- Mode mot de passe : nouvelle vérification du mot de passe côté serveur, avec limitation des tentatives.

### 9.9 Administration de division

Une page à ancres : Utilisateurs, Rôles et permissions, Workflows, Règles de saisie.

- **Utilisateurs** : recherche, invitation par e-mail, changement de rôle, rattachement à un manager, activation ou désactivation, pagination. Un compte désactivé ne peut plus se connecter mais ses données restent.
- **Rôles et permissions** : la matrice du §7.
- **Workflows** : étapes du circuit, adresse e-mail des RH (obligatoire), délai de relance (2, 3 ou 5 jours ouvrés), délégation au N+2.
- **Règles de saisie** : unité, jours ouvrés, heures par jour, pas (0,25 / 0,5 / 1 h), échéance (vendredi ou lundi suivant, avec l'heure), seuil d'alerte, saisie des semaines futures, verrouillage après validation.
- Chaque interrupteur a son état écrit à côté (Actif / Désactivé).

### 9.10 Administration plateforme

- Liste des divisions : nom, identifiant du tenant, administrateur, nombre d'utilisateurs, état, date de création.
- Onboarding en cinq étapes : Identité, Administrateur, Rôles et workflow, Règles de saisie, Récapitulatif. La progression est enregistrée à chaque étape et peut être reprise. À l'étape 2, on choisit de copier la configuration de CX Expertise (rôles, workflow, règles, jamais les données) ou de partir d'une configuration vierge. L'invitation de l'administrateur part à la fin.
- Journal d'audit : lecture seule. Filtres Division, Type d'action, Du, Au, Acteur ou objet. Pagination, export. On y trouve les connexions (échecs compris), soumissions, validations, rejets, signatures, envois aux RH, modifications de règles et de permissions, gestion des utilisateurs et des divisions.

### 9.11 Paramètres (tous les rôles)

- Profil et stage : lecture seule, géré par l'admin de division, avec un lien « Signaler une erreur ».
- Horaires habituels : arrivée et départ au format `hh:mm`.
- Notifications : rappel de saisie le vendredi à 12:00 si la semaine est incomplète ; e-mail à la validation ; e-mail au rejet ; rappel quand une fiche de présence attend une signature.
- Sécurité : changement de mot de passe.
- Préférences : langue (Français, English), mode de signature par défaut, reprise automatique des lignes de la semaine précédente.

## 10. Écrans et routes

| # | Écran | Route | Maquette (`design/ecrans/`) |
|---|---|---|---|
| 1 | Connexion | `/connexion` | `01-Connexion`, `01-Connexion-erreur`, `01-Connexion-mobile` |
| 2 | Tableau de bord | `/tableau-de-bord` | `02-Tableau-de-bord`, `02-Tableau-de-bord-mobile` |
| 3 | Saisie hebdomadaire | `/saisie/[annee]/[semaine]` | `03-Saisie-hebdo`, `03-Saisie-hebdo-mobile` |
| 4 | Confirmation de soumission | modale de l'écran 3 | `04-Confirmation` |
| 5 | Fiche rejetée | état de l'écran 3 | `05-Fiche-rejetee` |
| 6 | Ma fiche de présence RH | `/fiche-presence/[annee]/[mois]` | `06-Fiche-RH` |
| 7 | File de validation | `/validation` | `07-File-validation` |
| 8 | Détail d'une fiche | `/validation/[id]` | `08-Detail-fiche` |
| 9 | Gestion des projets | `/projets` | `09-Projets`, `09-Projets-colonnes`, `09-Projets-creation` |
| 10 | Reporting | `/reporting` | `10-Reporting` |
| 11 | Vue consolidée | `/division` | `11-Vue-consolidee` |
| 12 | Administration de division | `/administration` | `12-Admin-division` |
| 13 | Administration plateforme | `/plateforme`, `/plateforme/divisions/nouvelle` | `13-Admin-plateforme`, `13-Onboarding-division` |
| 14 | Paramètres | `/parametres` | `14-Parametres` |

Le bloc en pointillés « Prototype uniquement : entrer avec un profil » de l'écran de connexion ne doit pas exister en production. Garde-le derrière une variable d'environnement, pour la démonstration.

## 11. Les composants spécifiques

Ils n'existent pas dans ODS. Leur référence est dans les planches `C1-Selecteur-semaine`, `C2-Grille-etats-A`, `C2-Grille-etats-B`, `C3-Signature`, `C4-Etiquettes-statut` et dans l'écran 06.

1. **Sélecteur de semaine** (`.ts-week`). Trois boutons accolés : précédente, libellé « Semaine 12 · 16–20 mars 2026 », suivante. Le libellé ouvre un Dropdown des semaines récentes avec leur statut. Sur la semaine courante, un badge « Semaine courante » ; sur une autre semaine, un bouton raccourci du même nom. Hauteur 40 px, 50 px sur mobile où le libellé passe sur deux lignes. Largeur minimale du libellé : 320 px, pour que les flèches ne bougent pas. Le changement de semaine est annoncé par une zone de statut.
2. **Grille de saisie hebdomadaire** (`.ts-grid`). Un vrai `<table>` : lignes projet / activité, colonnes lundi à vendredi, total par ligne, total par jour avec badge de statut, total de la semaine. Six états : vide, partielle, complète, soumise, rejetée, validée. Tab passe à la cellule suivante, les flèches déplacent dans la grille. Chaque champ a un `aria-label` du type « Refonte parcours souscription, jeudi 19, heures ».
3. **Zone de signature électronique** (`.ts-sign`, `.ts-trace`). Voir §9.8.
4. **Aperçu de la fiche RH** (`.ts-viewer`, `.ts-sheet`). Visionneuse avec barre d'outils (nom du fichier, zoom, Télécharger le PDF, Imprimer) et la feuille au ratio A4 paysage. Le même gabarit sert au PDF.
5. **Étiquettes de statut** (`.badge.ts-st-*`). Le Badge ODS avec une forme par statut de projet : cercle vide (À démarrer), triangle (En cours), deux barres (En pause), coche (Terminé). La planche `C4-Etiquettes-statut` fixe aussi les libellés des fiches de temps, des jours de saisie et des fiches de présence. Ces libellés sont les seuls autorisés : un composant `<StatusBadge kind="project|timesheet|day|attendance" value="…" />` les centralise.
6. **Tableau en colonnes** (`.ts-board`). Voir §9.4.

## 12. États

Chaque écran de données a quatre états : normal, vide, chargement, erreur. Les gabarits sont dans `E1-Etat-vide`, `E2-Etat-chargement`, `E3-Etat-erreur`. Le texte exact de chaque état, écran par écran, est dans `E4-Etats-par-ecran`.

- **Vide** : bloc à bordure pointillée 2 px `#999999` sur fond `#fafafa`, une phrase qui explique, une action.
- **Chargement** : Placeholder ODS (variante du §4.3) qui reproduit la structure de la page. `aria-busy` sur la zone et un texte de statut masqué visuellement.
- **Erreur** : Alert danger qui dit ce qui s'est passé, ce qui est préservé et quoi faire, avec un bouton Réessayer. Sur la vue consolidée, l'erreur se gère bloc par bloc : un bloc en panne n'empêche pas d'afficher les autres.

## 13. Responsive

- Sous 1024 px, la barre latérale laisse place à la barre haute et à l'Offcanvas.
- À 375 px (conteneur de 312 px) :
  - la grille de cinq jours ne tient pas. La saisie passe à un jour à la fois : Tabs pills pour les jours, List group et Quantity selector par projet, bouton « Jour suivant ». Le modèle de données ne change pas ;
  - les tableaux du tableau de bord deviennent des List group ;
  - contrôles de 50 px ;
  - les H1 gardent 34 px, les titres doivent donc rester courts.
- Les autres tableaux défilent horizontalement dans `.table-responsive`.

## 14. Accessibilité (WCAG 2.2 AA)

- Aucune information portée par la couleur seule : chaque statut a un libellé et un glyphe.
- Liens toujours soulignés.
- Focus visible partout (double anneau).
- Modale et Offcanvas : focus piégé, fermeture par Échap, retour du focus sur le déclencheur, `aria-modal`, titre relié.
- Formulaires : `<label>` relié, `aria-required`, erreurs reliées par `aria-describedby`, légende « Les champs marqués d'un astérisque (*) sont obligatoires. »
- Tableaux : `<caption>` (masquée visuellement si besoin), `scope` sur les en-têtes.
- Un seul `<h1>` par page, aucun saut de niveau.
- Zones de statut pour la sauvegarde automatique, le changement de semaine et les résultats d'action.
- Cibles tactiles de 44 px au minimum sur mobile.
- Animations coupées sous `prefers-reduced-motion`.
- Contrastes connus sous le seuil et déjà compensés dans la maquette : `#ffd200` sur blanc (1,45:1), `#f16e00` sur blanc (3,0:1), `#ff7900` sur blanc (2,6:1), barre de progression sur sa piste (2,2:1). Ces couleurs ne portent jamais l'information seules. Ne retire pas les compensations.

## 15. Formats

- Dates : `16–20 mars 2026`, `20 mars 2026, 16:42`, `jj/mm/aaaa` en saisie. Tiret demi-cadratin pour les intervalles.
- Nombres : virgule décimale (`0,5 h`). Espace insécable avant `h` et `%`.
- Heures sur 24 h, `hh:mm`.
- Tous les textes d'interface passent par un dictionnaire (`fr` par défaut, `en` prévu). Reprends les libellés des maquettes mot pour mot.

## 16. Sécurité

- Isolation des tenants testée : pour chaque ressource, un test d'intégration vérifie qu'un utilisateur d'une division A n'obtient jamais une donnée d'une division B.
- Mots de passe en argon2id. Limitation des tentatives de connexion. L'échec est journalisé sans révéler si le compte existe.
- Protection CSRF sur toutes les mutations. Cookies `HttpOnly`, `Secure`, `SameSite=Lax`.
- Validation des entrées avec zod, côté serveur, sur chaque action.
- PDF signés stockés hors du dossier public, servis par une route qui vérifie les droits.
- Aucun secret dans le dépôt. Fournis un `.env.example`.

## 17. Qualité

- Tests unitaires : calcul des semaines ISO, totaux, statuts des jours, conditions de soumission, transitions de statut, permissions, génération de la fiche mensuelle.
- Tests de bout en bout : (1) le staff saisit, soumet, voit la lecture seule ; (2) le manager rejette avec motif, le staff corrige et soumet à nouveau, le manager valide ; (3) le stagiaire signe la fiche, le superviseur signe, l'e-mail part avec le PDF ; (4) l'admin change une règle et la saisie la respecte ; (5) l'admin plateforme crée une division.
- axe-core sur chaque route : zéro violation sérieuse ou critique.
- Contrôle de style du §4.2 en CI.
- ESLint et TypeScript sans erreur ni `any`.

## 18. Données de démonstration

Le script de seed reproduit les maquettes, pour qu'on puisse comparer écran par écran.

- Division CX Expertise, créée le 5 janvier 2026. Trois équipes : Parcours (Samuel Etoga, 6 personnes), Études (Hélène Nkoa, 5), Data CX (Olivier Manga, 4). 20 comptes actifs et 1 désactivé.
- Comptes de référence : Aïcha Ndongo (Staff, stagiaire, stage professionnel du 05/01/2026 au 26/06/2026), Samuel Etoga (Manager), Brigitte Mbarga (Owner), Paul Tchouta (Admin division), Rose Ekambi (Admin plateforme).
- Équipe de Samuel Etoga : Aïcha Ndongo, Kevin Fotso, Laure Bikoï, Ibrahim Njoya, Sandrine Mvondo, Yannick Essomba.
- Projets en cours : Refonte parcours souscription (CX-2026-01, 960 h), Baromètre NPS T1 2026 (CX-2026-02, 400 h), Cartographie des irritants (CX-2026-03, 600 h), Veille et formation (CX-2026-00, sans budget). Terminé : Tests d'usage appli mobile (CX-2026-04, 320 h). En pause : Refonte FAQ en ligne (CX-2026-05, 300 h). À démarrer : Enquête boutiques T2 2026 (CX-2026-06, 240 h, début le 6 avril 2026).
- Semaine de référence : semaine 12 de 2026, du 16 au 20 mars.
- Tous les noms sont fictifs. Adresses en `@exemple.com`. Ne mets aucune donnée réelle dans le dépôt.

## 19. Ce qui n'est pas maquetté

À construire avec les mêmes composants et les mêmes règles. Montre-moi une capture avant de considérer ces vues comme terminées.

- **Signature du superviseur.** Reprends la mise en page de l'écran 06 côté manager. On y accède depuis Validation, par un onglet « Fiches de présence à signer ».
- Le signalement de cellules par le manager au moment d'un rejet (écran 08).
- Mot de passe oublié et première connexion par lien d'invitation.
- Modale d'invitation et de modification d'un utilisateur.
- Modification et archivage d'un projet (même Offcanvas que la création), interrupteur « Afficher les projets archivés », mention « Date de fin dépassée ».
- L'état « Rien à faire pour l'instant » du tableau de bord, et la ligne « fiche rejetée à corriger » du bloc À faire.
- Étapes 1, 3, 4 et 5 de l'onboarding d'une division.
- Menu Exporter (Dropdown : CSV, Excel, PDF).
- Les écrans manager, owner et admin à 375 px.
- Les e-mails : invitation, rappel de saisie, fiche validée, fiche rejetée, signature attendue, envoi aux RH. Texte brut et HTML sobre, sans image.

## 20. Points ouverts

Avance avec la valeur par défaut, isole chaque point derrière un réglage ou une constante, et tiens la liste à jour dans `docs/questions-ouvertes.md`.

| Sujet | Valeur par défaut |
|---|---|
| Arrivée et Départ sur la fiche RH | Horaires habituels du stagiaire, pas de saisie jour par jour |
| Adresse e-mail des RH | Champ obligatoire dans les réglages de la division, vide dans le seed |
| « Version : 1.0 » et « Mise à jour le : 15/06/2023 » | Lus sur un scan peu lisible. Constantes dans un fichier de configuration |
| Envoi aux RH | Automatique après la signature du superviseur, désactivable |
| Absences, congés, jours fériés | La règle des 8 h par jour bloque la soumission d'une semaine avec une absence. Par défaut : une activité système « Absence » par division, qui compte dans le total du jour. Un jour entièrement en absence laisse Arrivée et Départ vides et s'ajoute au nombre de jours d'absence. Jours fériés dans un calendrier par division, attendus à 0 h |
| Semaine à cheval sur deux mois | Elle figure sur les deux fiches. Chaque fiche ne remplit que les jours de son mois |
| Staff non stagiaire | Pas de fiche de présence RH. Le lien de navigation est masqué |
| Authentification | E-mail et mot de passe. SSO Orange à brancher plus tard |
| Termes « manager » et « superviseur » | Même personne : le N+1. « Superviseur » n'apparaît que sur la fiche RH |
| Hébergement | Conteneur Docker, PostgreSQL géré à part. Fournis un `Dockerfile` et un `docker-compose.yml` de développement |

## 21. Méthode de travail

Avance par jalons. À la fin de chacun : lance les tests, compare tes écrans aux fichiers de `design/captures/`, fais un commit, résume en quelques lignes ce qui est fait et ce qui reste, puis attends mon accord avant de passer au suivant.

0. **Socle.** Projet Next.js, Prisma, lint, tests, contrôle de style. Couche de styles. Composants `components/ods/`. Une page `/design` qui expose chaque composant dans tous ses états, à comparer aux planches C1, C2, C3 et C4.
1. **Accès.** Authentification, divisions, rôles, permissions, navigation par rôle, layout desktop et mobile, seed. Écran 1.
2. **Saisie.** Écrans 2, 3, 4, 5 et leurs versions mobiles. Sauvegarde automatique.
3. **Validation.** Écrans 7 et 8. Rejet, nouvelle soumission, relances.
4. **Pilotage.** Écrans 9, 10, 11. Exports.
5. **Fiche de présence.** Écran 6. Génération mensuelle, signatures, PDF, e-mail aux RH, vue du superviseur.
6. **Administration de division et Paramètres.** Écrans 12 et 14.
7. **Plateforme.** Écran 13, onboarding, journal d'audit.
8. **Finitions.** États vide, chargement et erreur sur tous les écrans, passe d'accessibilité, vues mobiles manquantes, documentation (`README.md`, `docs/`).

Commence par me dire en quelques lignes ce que tu as compris, les points de la stack qui te posent un problème s'il y en a, puis lance le jalon 0.
