# Design, version 2

Revue UI/UX du 6 novembre 2026, appliquée à la réécriture (`frontend/`). Les maquettes de `design/` restent la référence pour tout ce qui n'est pas listé ici ; chaque écart ci-dessous est voulu.

## 1. Saisie par jour (remplace la grille projets × jours)

**Pourquoi.** Depuis la saisie en jours entiers (questions ouvertes, point 82), une journée va sur un seul projet. La grille des planches C2, pensée pour les heures, faisait taper « 1 » dans des champs texte et laissait mettre deux projets le même jour, puis le signalait (« Dépassement »).

**Ce qui change.**
- Une ligne par jour ouvré : le jour, une liste « Projet · activité », le statut. Même disposition au bureau et sur mobile (sur mobile, le jour et le statut en haut, la liste en dessous, contrôles de 50 px).
- Les choix sont les projets en cours dont la personne est membre, plus l'absence. Plus de bouton « Ajouter une ligne », plus de « Reprendre les lignes de la semaine précédente » (la reprise d'une semaine reste possible plus tard sous forme d'un bouton « Reprendre la semaine précédente », qui recopie les choix jour par jour).
- Statuts d'un jour : « À venir », « À saisir », « Complet », « À corriger ». « Incomplet » et « Dépassement » n'existent plus.
- En lecture seule (fiche soumise, validée), le choix devient du texte. Côté manager (écran 08), chaque journée saisie est un bouton qui la signale.
- Bas de saisie : « 3 sur 5 jours saisis », barre de progression (verte quand la semaine est complète), raison écrite à côté du bouton Soumettre tant qu'il manque un jour.

**Où.** `frontend/src/widgets/day-entry`, règles pures dans `frontend/src/entities/timesheet/lib/day-entry.ts`, planches `/design/c2-a` et `/design/c2-b`.

**À faire valider par les managers** avant le jalon 2.

## 2. État actif : un trait, pas un aplat

**Pourquoi.** `#ff7900` (état actif) et `#f16e00` (bouton primaire) sont très proches : sur la file de validation, quatre éléments orange pleins se disputaient l'attention et le bouton primaire n'était plus unique.

**Règle.**
- `#ff7900` marque l'élément **courant** par un trait de 5 px à gauche (`accent-mark`) : lien de la barre latérale, élément courant d'une liste ou d'un menu, en plus de `aria-current` et d'une coche ou du gras.
- Les éléments **sélectionnés** (case cochée, interrupteur actif, filtre en pastille, page courante de la pagination, menu ouvert) passent en noir, avec leur coche : la forme porte l'état.
- L'aplat orange reste au bouton primaire (`#f16e00`), à l'étape en cours d'un parcours en étapes et à l'instant où l'on appuie sur un bouton.

Écart avec les planches ODS (C1, C4) et avec Boosted : **à valider avec l'équipe ODS**.

## 3. Moins de gras

Le gras est réservé aux titres, aux chiffres clés, aux libellés de champs, aux étiquettes, aux en-têtes de tableau et aux actions. La valeur saisie dans un champ, le contenu des cellules et les éléments d'un menu sont en 400.

## 4. Symboles de statut : une forme par sens

| Forme | Sens | Exemples |
|---|---|---|
| coche | fait | Validée, Complet, Signée |
| croix | refusé, à corriger | Rejetée, À corriger |
| ! | en retard, bloqué | Manquante, Division suspendue |
| sablier | en attente d'une autre personne | En attente de validation, En attente du superviseur, En revue |
| crayon | une action vous attend | À saisir, À signer |
| lecture | en cours | Projet en cours, Onboarding |
| pause | suspendu | En pause |
| cercle | pas commencé | À démarrer, À faire |

Avant, « En attente » portait un « i » (information) et quatre statuts jaunes de gravité différente portaient le même « ! ». Les couleurs ne changent pas ; les libellés non plus (planche C4).

## 5. Tableau de bord (écran 02, jalon 2)

- **Une seule action principale** : le bouton orange vise toujours l'action la plus urgente (semaine en retard avant semaine en cours, fiche à signer avant semaine à venir). Les autres actions sont des boutons secondaires.
- **Pas de doublon** : une semaine présente dans « À faire » n'est pas répétée dans « Dernières semaines » avec la même action.
- **« Mes projets » replié** pour un staff (titre et nombre de projets, dépliable) : budgets et activités ne servent pas au quotidien.
- **Moins de cadres** : pas de carte dans une carte ; l'espacement (30 px entre blocs) sépare les sections.
- **Semaine en cours sans sélecteur de semaine** : le tableau de bord montre la semaine courante ; on change de semaine sur l'écran de saisie, ou par « Dernières semaines ». Le numéro et la période sont écrits sous le titre.

## 6. File de validation (écrans 07 et 08, jalon 3)

- **Valider par exception** : chaque ligne montre ce qui demande l'attention (commentaire du collaborateur, deuxième soumission, absence dans la semaine, projet inhabituel pour la personne), sous forme d'étiquettes neutres à côté du nom.
- **Colonne Statut masquée** quand le filtre est « En attente » (elle répéterait la même valeur partout) ; affichée pour « Toutes ».
- **Colonne Jours** : « 5 / 5 » sur une ligne, colonne assez large pour ne jamais passer à la ligne.
- Détail (08) : saisie par jour en lecture seule, chaque journée signalable (planche `/design/c2-b`, dernière section).

## 7. Maquettes à produire

Écrans réalisés ou à réaliser sans planche, à faire passer par le design pour rester cohérents :
- saisie par jour (C2 version 2) et son écran 03 complet ;
- tableau de bord et file de validation selon §5 et §6 ;
- tableau Kanban des tâches (écran 15) ;
- gestion d'une division côté plateforme (point 71) ;
- page « Page introuvable », écran « en préparation », messages d'erreur ajoutés depuis les maquettes ;
- les planches C1 à C4 mises à jour selon §2 à §4.
