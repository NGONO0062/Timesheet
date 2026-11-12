# Écarts avec ODS

Depuis la réécriture (novembre 2026), Boosted n'est plus chargé. Les composants ODS sont reproduits en Tailwind 4 et HeadlessUI dans `frontend/src/shared/ui/`, tels que les planches C1 à C4 (`design/`) les montrent. Le thème (`frontend/src/app/styles/index.css`) ne contient que les valeurs permises par `CLAUDE.md`, et `frontend/scripts/check-styles.mjs` refuse toute autre valeur. L'ancienne version de ce document, qui décrivait les corrections apportées à Boosted, reste dans l'historique Git.

Référence ODS : partie Web de [system.design.orange.com](https://system.design.orange.com/0c1af118d/p/8118d1-web), relue le 12 novembre 2026 (couleurs, typographie, espacements, composants, Data Display, accessibilité).

## Ce qui est conforme

- **Couleurs** : les 12 couleurs de l'application sont celles d'ODS : noir, blanc, orange de marque `#ff7900`, orange accessible `#f16e00`, couleurs fonctionnelles (`#228722` succès, `#cd3c14` critique, `#ffd200` alerte, `#4170d8` information) et gris fonctionnels.
- **Espacements** : les jetons Web d'ODS valent 0, 5, 10, 15, 20, 25, 30… 60 px ; 0, 5, 10, 20, 30 et 60 en sont un sous-ensemble.
- **Typographie** : deux graisses, comme Helvetica Neue 75 Bold et 55 Roman ; à défaut de Helvetica Neue, la police du système, en deux graisses seulement.
- **Liens** : soulignés ; survol en orange `#f16e00` (ODS admet le noir ou l'orange, jamais l'orange sur une couleur de soutien).
- **Accessibilité** : ODS teste en WCAG 2.2 AA (AAA sur mobile) ; les tests de bout en bout passent axe sur chaque route, au bureau et à 375 px.

## Écarts assumés

| # | Composant | ODS | TimeSheet | Raison |
|---|---|---|---|---|
| 1 | Champs de saisie | Bordure `#999999` | Bordure noire de 2 px ; grise seulement à l'état désactivé | `#999` fait 2,85:1 sur blanc, sous le 3:1 exigé pour un composant d'interface. `#999` reste aux séparateurs. |
| 2 | Chargement (placeholder) | Opacité et vague en dégradé | Aplat `#dddddd` qui bat, coupé sous `prefers-reduced-motion` | Opacité et dégradé sont interdits. |
| 3 | État actif et sélection | Aplat `#ff7900` (pastilles, interrupteur, pagination) | Élément courant : trait de 5 px `#ff7900` (`accent-mark`) ; éléments sélectionnés en noir, avec leur coche | `#ff7900` et le primaire `#f16e00` se disputaient l'attention (`docs/design-v2.md`, §2). Validé le 12 novembre 2026. |
| 4 | Étiquettes de statut | Libellé et couleur | Glyphe (coche, croix, « ! », « i ») et libellé, un seul composant `<StatusBadge>` | Aucune information portée par la couleur seule. |
| 5 | Voile de modale et de panneau | Noir à 50 % | Identique | Seule transparence de l'application. |
| 6 | Graphiques | Pas de composant Web ; règles et jetons `color.dataviz.*` dans Data Display | Barres et colonnes en SVG sans bibliothèque (`widgets/charts`), quatre couleurs de séries `#237eca`, `#198c51`, `#6e4aa7`, `#d573bb` | Les couleurs viennent des rampes de Boosted ; elles ne correspondent plus aux couleurs catégorielles d'ODS. Gardées : validé le 12 novembre 2026 (`docs/questions-ouvertes.md`, point 88). |
| 7 | Valeur rapportée à un total (budget, délai, tâches, remplissage) | La barre de progression suit une opération système (téléchargement, traitement) ; une valeur face à un total est une jauge horizontale (Data Display) | Composant `<Progress>` | Dessin proche de la jauge horizontale. Gardé : validé le 12 novembre 2026 (point 88). |
| 8 | Libellés d'axe des graphiques | Texte toujours aligné à gauche, sauf boutons, onglets, stickers et libellés sous une icône | Centrés sous leur colonne | Le libellé désigne la colonne au-dessus de lui. Validé le 12 novembre 2026 (point 88). |
| 9 | Dates | Pas de sélecteur de date Web (seulement un sélecteur d'heure) | Saisie texte `jj/mm/aaaa`, format rappelé sous le champ (`<DateField>`) | Aucun composant ODS à reproduire. |
| 10 | Navigation latérale | Module « Side navigation » | Barre verticale sur fond noir, lien courant marqué par `accent-mark` (`widgets/app-shell`) | Reprise des maquettes de TimeSheet. Gardée : validé le 12 novembre 2026. |

## Comportement

Fenêtre (Modal), panneau latéral (Offcanvas), menu déroulant, onglets, popover et accordéon prennent leur comportement accessible dans HeadlessUI (focus piégé, Échap, flèches) ; leur apparence suit les planches. Les menus déroulants ne sont pas modaux : un menu ouvert ne rend pas le reste de la page inerte (`docs/reecriture.md`, jalon 8). Toutes les animations sont coupées sous `prefers-reduced-motion`.
