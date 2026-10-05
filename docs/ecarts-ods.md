# Écarts avec ODS (Boosted 5.3)

Boosted est chargé tel quel (`boosted/dist/css/boosted.css`). La couche `styles/timesheet.css` le corrige quand un rendu par défaut contredit un token du brief (PROMPT.md §4.1). La règle : le token gagne.

## Écarts assumés (PROMPT.md §4.3)

| # | Composant | Boosted | TimeSheet | Raison |
|---|---|---|---|---|
| 1 | Champs de saisie | Bordure `#999999` | Bordure noire | `#999` fait 2,85:1 sur blanc, sous le 3:1 exigé pour un composant d'interface. `#999` reste aux séparateurs. |
| 2 | Placeholder | Opacité et vague en dégradé | Aplat `#dddddd` plein, battement de couleur, coupé sous `prefers-reduced-motion` | Opacité et dégradé sont interdits. |
| 3 | Pill active | Fond `#ff7900` | Fond `#ff7900` et coche avant le libellé | `#ff7900` sur blanc fait 2,6:1 : la couleur seule ne suffit pas. Même règle pour le bouton actif d'un Button group. |
| 4 | Badges de statut | Libellé seul | Glyphe (coche, croix, « ! », « i ») et libellé | Aucune information portée par la couleur seule. |
| 5 | Voile de modale et d'offcanvas | Noir à 50 % | Identique | Seule transparence de l'application. |
| 6 | Graphiques | Pas de composant | Barres et colonnes en HTML et CSS, classes `.chart-*`, quatre couleurs de séries (`#237eca`, `#198c51`, `#6e4aa7`, `#d573bb`) | ODS Web n'a pas de composant graphique. |
| 7 | Dates | Pas de sélecteur | Saisie texte `jj/mm/aaaa`, format rappelé sous le champ (`<DateField>`) | ODS Web n'a pas de sélecteur de date. |
| 8 | Navigation latérale | Pas de barre latérale | Nav vertical sur fond noir (`.sidenav`) | ODS Web n'a pas de barre latérale. |

## Rendus Boosted neutralisés (section 0 de `timesheet.css`)

Repérés en comparant `/design` aux planches C1 à C4 rendues dans le même navigateur.

| Composant | Rendu Boosted | Correction | Token concerné |
|---|---|---|---|
| Texte courant, `.lead`, boutons, légendes | Approche négative (`:root > *`, `.lead`, `.btn`, `caption`) | `letter-spacing: normal` | Le brief ne fixe d'approche que pour les titres. |
| Puces de liste | Orange de marque (`li::marker`) | Couleur du texte | `#ff7900` réservé à l'état actif. |
| `.text-secondary`, `.text-danger` | Utilitaires en `!important` sur d'autres valeurs | `#595959`, `#cd3c14` | Palette. Sélecteur `:root .text-secondary` : le compilateur CSS de Next fusionnait sinon la surcharge avec la règle de la section 1 et perdait le `!important`. |
| Marqueur de champ requis | Astérisque en position absolue, sans espace | Astérisque dans le flux, précédé d'une espace | Maquette. |
| Listes de définitions | `dt` en gras | 400 | Maquette. |
| Texte d'aide `.form-text` | Gras | 400 | Maquette. |
| Message d'erreur `.invalid-feedback` | Icône en `::before` | Masquée, la pastille `.mark-danger` la remplace | Une forme par statut, pas deux. |
| Boutons | `opacity` au désactivé, `z-index`, transitions | Opaque, sans transition | Désactivé opaque ; survol par inversion nette. |
| Button group, Input group | Marge négative de 2 px entre éléments | Supprimée (la maquette retire la bordure gauche) | Bordures de 2 px sans recouvrement. |
| Case à cocher, radio | Flottant, marge négative, image de fond | Flex, coche dessinée en CSS | Maquette. |
| Interrupteur | Bordure blanche, dégradé, image de fond | Bordure noire, aplat `#ff7900` coché | Aucun dégradé. |
| Quantity selector | Largeur fixe de 120 px, icônes en masque CSS, bordure `#999` | Boutons ODS 40 / 50 px, icônes de l'application, bordure noire | Hauteurs de contrôle ; bordure de champ noire. |
| Select | Flèche Boosted effacée par la couche ODS | Flèche Boosted rétablie, marge droite 30 px | La maquette garde la flèche native. |
| Table | Fond de cellule et ombre interne (`box-shadow: inset`) | Transparents, sans ombre | Aucune ombre ; le survol de ligne (`#ddd`) doit rester visible. |
| Placeholder | `opacity: .5`, `cursor: wait` | Opaque | Désactivé et chargement sans opacité. |
| Dropdown | `display: none` et position gérés par le JS Boosted | Rendu par React, positionné en CSS | Le JS Boosted n'est pas chargé (PROMPT.md §3). |
| Modal, Offcanvas | `pointer-events: none`, `visibility: hidden`, `transform` | Rendus par React | Idem. |
| Toast | Masqué sans `.show` | Visible tant qu'il est rendu | Idem. |
| Spinner | Bordure de 0,25 em | 2 px | Bordures de 2 px. |
| Toutes animations | — | Coupées sous `prefers-reduced-motion` | Accessibilité (§14). |

## Composants sans JavaScript Boosted

Modal, Offcanvas, Dropdown, Tabs, Tooltip, Popover et Accordion sont des composants React (`components/ods/`) qui reprennent le balisage et les classes Boosted. Le JavaScript de Boosted n'est pas importé : il manipule le DOM dans le dos de React.
