# Maquettes TimeSheet

Référence visuelle de l'application. Les règles métier et la méthode sont dans `PROMPT.md`, à la racine.

## Contenu

- `ods.css` : feuille de style de la maquette (tokens du design system, classes aux noms Boosted, composants spécifiques préfixés `.ts-`).
- `ecrans/` : chaque planche en HTML statique, liée à `../ods.css`. Les liens entre écrans fonctionnent.
- `captures/` : la capture PNG de chaque planche, à la taille du cadre.
- `prototype/` : sources des cinq écrans à logique (03, 06, 07, 08, 09). La logique est dans le bloc `<script type="text/x-dc">` en bas de fichier. Ces fichiers ne s'ouvrent pas seuls : ils dépendent du moteur de l'outil de maquettage.

## Planches

### Parcours Staff

| Planche | Cadre | Fichier |
|---|---|---|
| 01 · Connexion | 1280 × 800 | `ecrans/01-Connexion.html` |
| 01 · Connexion · mobile 375 | 375 × 880 | `ecrans/01-Connexion-mobile.html` |
| 02 · Tableau de bord | 1280 × 1570 | `ecrans/02-Tableau-de-bord.html` |
| 02 · Tableau de bord · mobile 375 | 375 × 1990 | `ecrans/02-Tableau-de-bord-mobile.html` |
| 03 · Saisie hebdomadaire | 1280 × 1050 | `ecrans/03-Saisie-hebdo.html` |
| 03 · Saisie hebdomadaire · mobile 375 | 375 × 1270 | `ecrans/03-Saisie-hebdo-mobile.html` |
| 04 · Confirmation de soumission | 1280 × 860 | `ecrans/04-Confirmation.html` |
| 05 · Fiche rejetée | 1280 × 1270 | `ecrans/05-Fiche-rejetee.html` |
| 06 · Ma fiche de présence RH | 1280 × 2030 | `ecrans/06-Fiche-RH.html` |
| 14 · Paramètres | 1280 × 1930 | `ecrans/14-Parametres.html` |

### Parcours Manager et Owner

| Planche | Cadre | Fichier |
|---|---|---|
| 07 · File de validation | 1280 × 920 | `ecrans/07-File-validation.html` |
| 08 · Détail d'une fiche | 1280 × 1020 | `ecrans/08-Detail-fiche.html` |
| 09 · Gestion des projets · liste | 1280 × 870 | `ecrans/09-Projets.html` |
| 09 · Gestion des projets · vue en colonnes | 1280 × 1280 | `ecrans/09-Projets-colonnes.html` |
| 09 · Gestion des projets · création et affectation | 1280 × 950 | `ecrans/09-Projets-creation.html` |
| 10 · Reporting | 1280 × 1370 | `ecrans/10-Reporting.html` |
| 11 · Vue consolidée de la division | 1280 × 1210 | `ecrans/11-Vue-consolidee.html` |

### Administration

| Planche | Cadre | Fichier |
|---|---|---|
| 12 · Administration de division | 1280 × 2360 | `ecrans/12-Admin-division.html` |
| 13 · Administration plateforme | 1280 × 1330 | `ecrans/13-Admin-plateforme.html` |
| 13 · Onboarding d'une division | 1280 × 920 | `ecrans/13-Onboarding-division.html` |

### États des écrans de données

| Planche | Cadre | Fichier |
|---|---|---|
| État vide | 1280 × 800 | `ecrans/E1-Etat-vide.html` |
| État de chargement | 1280 × 800 | `ecrans/E2-Etat-chargement.html` |
| État d'erreur | 1280 × 800 | `ecrans/E3-Etat-erreur.html` |
| États par écran de données | 1280 × 1080 | `ecrans/E4-Etats-par-ecran.html` |

### Composants spécifiques (hors ODS)

| Planche | Cadre | Fichier |
|---|---|---|
| Composant 1 · Sélecteur de semaine | 1280 × 1420 | `ecrans/C1-Selecteur-semaine.html` |
| Composant 2 · Grille : vide, partielle, complète | 1280 × 2050 | `ecrans/C2-Grille-etats-A.html` |
| Composant 2 · Grille : soumise, rejetée, validée | 1280 × 1770 | `ecrans/C2-Grille-etats-B.html` |
| Composant 3 · Zone de signature électronique | 1280 × 860 | `ecrans/C3-Signature.html` |
| Composant 5 · Étiquettes de statut | 1280 × 1840 | `ecrans/C4-Etiquettes-statut.html` |

## Notes par planche

Pour chaque écran : composants ODS utilisés, composants spécifiques, tensions entre le besoin et le design system.

**01 · Connexion** (`01-Connexion`)

- ODS : Orange navbar, Input, Input group, Button (primary, default), Card, Footer.
- Spécifiques : aucun.
- Tension : le marqueur requis #f16e00 fait 3,0:1 sur blanc, sous le 4,5:1 d'un texte. Il est doublé par aria-required et par la légende des champs obligatoires.

**01 · Connexion · mobile 375** (`01-Connexion-mobile`)

- Conteneur 312 px. Contrôles large de 50 px pour le tactile. H1 à 34 px comme sur desktop : titres courts obligatoires.

**02 · Tableau de bord** (`02-Tableau-de-bord`)

- ODS : Nav vertical (navigation latérale), List group, Card, Badge, Progress, Tag, Table, Button, Footer.
- Spécifiques : sélecteur de semaine, étiquettes de statut de projet.
- Ordre de lecture : ce qui est en retard (À faire), la semaine en cours, mes projets, l'historique. Un seul bouton primaire, « Continuer la saisie ». Sans action en attente, le bloc À faire affiche « Rien à faire pour l'instant ».
- Tension : l'avertissement #ffd200 fait 1,45:1 sur blanc. Il ne porte jamais l'information seul : pastille à glyphe noir et titre en gras.

**02 · Tableau de bord · mobile 375** (`02-Tableau-de-bord-mobile`)

- Même ordre que sur desktop. Les actions du bloc À faire ont un bouton pleine largeur de 50 px. Le tableau « Dernières semaines » devient un List group. Navigation dans un Offcanvas ouvert par le bouton menu.

**03 · Saisie hebdomadaire** (`03-Saisie-hebdo`)

- ODS : Breadcrumb, Badge, Input (cellules), Button, Progress, Footer.
- Spécifiques : sélecteur de semaine, grille de saisie, indicateur de sauvegarde automatique (zone de statut).
- Tensions : la bordure discrète #999 fait 2,85:1, sous le 3:1 exigé pour un champ ; les cellules prennent donc la bordure noire et #999 reste aux séparateurs. Bouton Soumettre désactivé : la raison est écrite à côté.

**03 · Saisie hebdomadaire · mobile 375** (`03-Saisie-hebdo-mobile`)

- Tension majeure : la grille de 5 jours ne tient pas dans 312 px. Elle pivote en un jour à la fois : Tabs pills pour les jours, List group et Quantity selector par projet. Même modèle de données que la grille desktop.

**04 · Confirmation de soumission** (`04-Confirmation`)

- ODS : Modal, Table, Alert (info), Button.
- Spécifiques : aucun, la grille est en arrière-plan.
- À noter : le voile de la modale est celui de Boosted (noir à 50 %). C'est la seule transparence de la maquette.
- Dans le prototype, cette modale s'ouvre depuis l'écran 03. Cette planche reste la référence de l'état.

**05 · Fiche rejetée** (`05-Fiche-rejetee`)

- ODS : Alert (danger), Badge, Input (invalide), List group, Button.
- Spécifiques : grille en état rejeté, sélecteur de semaine avec raccourci.
- Le motif du manager est dans le bandeau. La cellule signalée est reliée à son message, et le jour concerné porte le badge « À corriger ».

**06 · Ma fiche de présence RH** (`06-Fiche-RH`)

- ODS : Select, Stepped process, Checkbox, Tabs pills, Alert (info), Badge, Button.
- Spécifiques : aperçu de fiche RH (composant 4) au format du modèle OCM/PS-01/SE/049, A4 paysage ; zone de signature et bloc de traçabilité (composant 3).
- Tensions : le modèle ne prévoit que la signature du superviseur, celle du stagiaire reste dans l'application. Il demande Arrivée et Départ, que la grille ne collecte pas. Version et date de mise à jour sont peu lisibles sur le scan (lues : 1.0 et 15/06/2023).
- Transmission aux RH par e-mail, PDF en pièce jointe. L'adresse des RH se règle dans l'administration de division (écran 12).

**14 · Paramètres** (`14-Parametres`)

- ODS : Card, Input, Switch, List group, Select, Radio, Button.
- Spécifiques : aucun.
- Cinq volets : profil et stage (lecture seule, repris sur la fiche RH), horaires habituels, notifications, sécurité, préférences. Accessible depuis la navigation latérale de tous les rôles ; la planche montre la version Staff.

**07 · File de validation** (`07-File-validation`)

- ODS : Select, Tabs pills, Checkbox, Table, Badge, Tag, Button, Card.
- Spécifiques : aucun.
- La barre d'actions groupées n'apparaît qu'avec une sélection. Le rejet groupé ouvre une Modal pour le motif commun.
- Tension : pill active #ff7900 sur blanc = 2,6:1. Une coche est ajoutée pour ne pas dépendre de la couleur.

**08 · Détail d'une fiche** (`08-Detail-fiche`)

- ODS : Breadcrumb, Badge, Radio, Input (zone de texte), List group, Button (danger), Card.
- Spécifiques : grille en lecture seule.
- La décision est un formulaire (radio et motif requis) plutôt qu'une modale : le manager garde la grille sous les yeux en rédigeant le motif.

**09 · Gestion des projets · liste** (`09-Projets`)

- ODS : Tabs pills, Button group, Table, Dropdown, Progress, Badge, Alert, Button.
- Spécifiques : étiquettes de statut de projet (À démarrer, En cours, En pause, Terminé).
- Une seule étiquette par ligne : le statut. Le dépassement de budget passe en texte sous la barre. L'étiquette est le bouton qui change le statut ; le changement est immédiat, avec « Annuler » dans le message.
- Tension : barre #f16e00 sur piste #ddd = 2,2:1. La valeur est toujours écrite au-dessus de la barre.

**09 · Gestion des projets · vue en colonnes** (`09-Projets-colonnes`)

- ODS : Button group, Card, Dropdown, Progress, Badge.
- Spécifiques : tableau en colonnes (.ts-board), une colonne par statut.
- Mêmes données que la liste. Pas de glisser-déposer : le statut se change par l'étiquette, au clavier comme à la souris. Sous 1024 px, la vue repasse en liste.

**09 · Gestion des projets · création et affectation** (`09-Projets-creation`)

- ODS : Offcanvas, Input, Select, Input group, Tag, Checkbox, Button.
- Spécifiques : aucun.
- Le statut se choisit à la création, « À démarrer » par défaut. Dates en saisie texte jj/mm/aaaa : ODS Web n'a pas de sélecteur de date.

**10 · Reporting** (`10-Reporting`)

- ODS : Tabs pills, Select, Card, Table, Button (menu Exporter : CSV, Excel, PDF).
- Spécifiques : aucun.
- Tension : ODS Web n'a pas de composant graphique et les douze couleurs du brief n'ont pas de couleurs de séries. Les graphiques prennent quatre teintes des rampes ODS livrées dans Boosted (bleu #237eca, vert #198c51, violet #6e4aa7, rose #d573bb), réservées aux graphiques. Une couleur par projet, la même dans les deux graphiques. Chacune fait au moins 3:1 sur blanc ; légende, valeurs écrites et tableau en dessous.

**11 · Vue consolidée de la division** (`11-Vue-consolidee`)

- ODS : Card, Table, Progress, Badge, Button.
- Spécifiques : sélecteur de semaine.
- Indicateurs, taux de remplissage par équipe, dérives. Le seuil de sous-remplissage (80 %) vient des règles de la division.
- Graphique à une seule série : une seule couleur, le bleu des graphiques (#237eca).

**12 · Administration de division** (`12-Admin-division`)

- ODS : Input group, Table, Select, Switch, Checkbox, Radio, List group, Pagination, Badge, Button.
- Spécifiques : aucun.
- Les quatre volets sont sur une page à ancres (liens « Sur cette page »). Chaque Switch a son état écrit à côté.

**13 · Administration plateforme** (`13-Admin-plateforme`)

- ODS : Alert (info), Table, Tag, Badge, Select, Input, Input group, Pagination, Button.
- Spécifiques : aucun.
- Le badge de la navigation passe à « Toutes les divisions ». Seule CX Expertise est connue : la deuxième ligne est un emplacement.

**13 · Onboarding d'une division** (`13-Onboarding-division`)

- ODS : Breadcrumb, Stepped process, Input, Radio, Card, Alert (info), Button.
- Spécifiques : aucun.
- Cinq étapes : identité, administrateur, rôles et workflow, règles de saisie, récapitulatif.

**État vide** (`E1-Etat-vide`)

- ODS : Tabs pills, Button. Bloc vide : bordure pointillée 2 px #999, fond #fafafa.

**État de chargement** (`E2-Etat-chargement`)

- ODS : Placeholder.
- Tension : le Placeholder de Boosted repose sur l'opacité et une vague en dégradé, deux interdits du brief. Ici, aplat #ddd plein avec un battement de couleur, coupé si l'utilisateur réduit les animations.

**État d'erreur** (`E3-Etat-erreur`)

- ODS : Alert (danger), Button. Le message dit ce qui s'est passé, ce qui est préservé et quoi faire.

**États par écran de données** (`E4-Etats-par-ecran`)

- Contenu des trois états pour chaque écran de données.

**Composant 1 · Sélecteur de semaine** (`C1-Selecteur-semaine`)

- Composant 1 · Sélecteur de semaine. Assemblé avec Button, Badge et Dropdown ODS.

**Composant 2 · Grille : vide, partielle, complète** (`C2-Grille-etats-A`)

- Composant 2 · Grille de saisie. Cellules = Input ODS dans un tableau HTML, totaux par ligne et par jour, statut du jour en Badge.

**Composant 2 · Grille : soumise, rejetée, validée** (`C2-Grille-etats-B`)

- Composant 2, suite. En lecture seule, les valeurs sont du texte et non des champs désactivés : le gris #595959 sur #ddd resterait lisible, mais un champ désactivé n'est pas atteignable au clavier.

**Composant 3 · Zone de signature électronique** (`C3-Signature`)

- Composant 3 · Zone de signature électronique. Le composant 4, l'aperçu de fiche RH, est montré en situation dans l'écran 06.

**Composant 5 · Étiquettes de statut** (`C4-Etiquettes-statut`)

- Composant 5 · Étiquettes de statut. Référence du vocabulaire pour toute l'application : projet, fiche de temps, jour de saisie, fiche de présence RH. Les étiquettes de projet réutilisent le Badge ODS avec une forme par statut (cercle, triangle, deux barres, coche).

## Hypothèses de la maquette

- Saisie en heures : 8 h par jour, 40 h par semaine, pas de 0,5 h (règles de la division, écran 12).
- Fiche de présence RH : gabarit repris du modèle OCM/PS-01/SE/049 fourni. Une fiche par mois, six blocs de semaine.
- Arrivée et départ : le modèle les demande, la grille de saisie ne les collecte pas. Ils viennent des horaires habituels (écran 14). À confirmer.
- Navigation latérale : ODS Web n'a pas de barre latérale, elle est assemblée avec le Nav vertical. Sur mobile, elle s'ouvre en Offcanvas par le bouton menu.
- Semaine 12 de 2026 = 16–20 mars (17–21 mars correspond à 2025).
- Statuts de projet : À démarrer, En cours, En pause, Terminé. Seuls les projets En cours acceptent la saisie.
- Noms, projets et chiffres sont des données d'exemple.
- Pas de logo : le mot « TimeSheet », « Time » en orange d'interface #f16e00 et « Sheet » en blanc, sur fond noir.
- Icônes : tracés génériques en attendant les icônes Solaris.
- Styles : feuille ods.css, classes aux noms Boosted ; préfixe .ts- pour les composants hors ODS.

## Données

Noms, projets et chiffres sont des données d'exemple, cohérentes d'un écran à l'autre (semaine 12 de 2026, du 16 au 20 mars). Le seed de l'application doit les reproduire.
