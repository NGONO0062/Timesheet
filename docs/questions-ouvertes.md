# Questions ouvertes

Chaque point avance avec sa valeur par défaut, isolée derrière un réglage ou une constante. Statut : **ouvert** tant que personne n'a tranché.

## Points du brief (PROMPT.md §20)

| Sujet | Valeur par défaut | Où dans le code | Statut |
|---|---|---|---|
| Arrivée et Départ sur la fiche RH | Horaires habituels du stagiaire (`User.usualArrival`, `User.usualDeparture`) | `prisma/schema.prisma` | ouvert |
| Adresse e-mail des RH | Champ obligatoire des réglages de la division, vide dans le seed | `DivisionSettings.hrEmail` | ouvert |
| « Version : 1.0 » et « Mise à jour le : 15/06/2023 » | Constantes de configuration (jalon 5) | à venir | ouvert |
| Envoi aux RH | Automatique après la signature du superviseur, désactivable | `DivisionSettings.hrAutoSend` | ouvert |
| Absences, congés, jours fériés | Activité système « Absence » par division ; jours fériés attendus à 0 h | `Project.isSystem`, `Holiday`, `expectedPerDay()` | ouvert |
| Semaine à cheval sur deux mois | Figure sur les deux fiches, chacune ne remplit que les jours de son mois | jalon 5 | ouvert |
| Staff non stagiaire | Pas de fiche de présence ; lien masqué | jalon 1 | ouvert |
| Authentification | E-mail et mot de passe ; SSO Orange plus tard | jalon 1 | ouvert |
| « Manager » et « superviseur » | Même personne (N+1) ; « Superviseur » seulement sur la fiche RH | — | ouvert |
| Hébergement | Conteneur Docker, PostgreSQL géré à part | `Dockerfile`, `docker-compose.yml` | ouvert |

## Relevés pendant le jalon 0

1. **Version de Node.** La machine de développement a Node 22.11. Prisma 7 exige 22.12 au minimum : le projet utilise donc Prisma 6.19 (stable). Passer à Node 22.12 ou plus permettra de monter en Prisma 7 sans autre changement de modèle. Plusieurs outils (ESLint) signalent aussi 22.13 comme minimum.
2. **Libellé du mode de signature par mot de passe.** La planche C3 écrit « Mot de passe », l'écran 06 « Valider par mot de passe ». Le composant reprend C3. À trancher.
3. **Bouton « Signer » désactivé en mode tracé.** La planche C3 le montre désactivé sans raison écrite. Le §5 du brief exige la raison à côté d'un bouton désactivé : le composant écrit « Tracez votre signature dans le cadre. » sous les boutons. En mode mot de passe, le bouton reste actif comme sur C3, et le manque s'affiche au clic.
4. **Flèche du Select.** Dans la maquette, sans Boosted, le navigateur affiche sa flèche native. Avec Boosted, la flèche ODS est rétablie (voir `docs/ecarts-ods.md`). Rendu légèrement différent de la capture.
5. **Signalement de cellules dans la planche C2-B.** La planche place le message de la cellule signalée à gauche du bouton « Soumettre à nouveau ». Le composant de grille place les messages d'erreur sous le tableau, et l'écran place le bouton en dessous. À valider sur l'écran 05 au jalon 2. **Réglé au jalon 2** : l'écran 05 place lui aussi le message sous la grille.
6. **Git.** Réglé : Git 2.55 installé le 4 octobre, dépôt poussé sur GitHub (privé).
7. **Polices.** Helvetica Neue n'est pas embarquée (licence) : la pile retombe sur Arial sous Windows. Les captures de comparaison sont faites dans les mêmes conditions.

## Mise à jour des maquettes (branche `maj-maquettes`)

8. **Lot 2, partie serveur reportée (accord du 4 octobre).** La migration de reprise n'a pas lieu d'être : aucune base n'existe encore, et la première migration (jalon 1) part du schéma qui porte déjà `status`, `statusChangedAt` et `statusChangedById`. Le seed (trois projets ajoutés à l'équipe de Samuel Etoga) arrive au jalon 1, le refus d'heures côté serveur au jalon 2, le changement de statut avec `AuditLog` et le test d'isolation entre divisions au jalon 4. Les règles pures sont déjà dans `lib/projects/rules.ts` et `lib/permissions.ts`, testées.
9. **Poste de développement infecté.** Un virus remplace les exécutables non signés de `node_modules` (esbuild, moteur Prisma) par une souche de 533 504 octets (SHA-256 `1B68201A…170E`). Sur ce poste, le binaire esbuild officiel est remis avant chaque série de tests. Tant que la machine n'est pas nettoyée, les tests de bout en bout et les captures ne sont pas fiables ici.

## Jalon 1 : accès

10. **Authentification : Auth.js avec sessions JWT** (choix du 5 octobre). Le fournisseur e-mail + mot de passe d'Auth.js n'accepte pas les sessions en base prévues au §3. Le jeton ne porte que l'identifiant ; chaque requête relit le compte en base (`lib/data/users.ts`, `loadViewer`), donc un compte désactivé ou une division suspendue perd l'accès tout de suite. La table `Session` a été retirée du schéma.
11. **Navigation de l'admin de division et du manager.** Le §6 calcule la navigation à partir des permissions effectives. Avec la matrice par défaut (§7), l'admin de division a aussi « Gérer les projets » et « Voir la vue consolidée » : sa barre latérale montre Administration, Vue division, Projets, Reporting, alors que la planche 12 n'affiche qu'Administration et Reporting. De même, le manager voit les liens Staff (il peut saisir ses temps), absents de la planche 07. Le code suit la règle du §6. À trancher : modifier la matrice par défaut, ou accepter ces liens.
12. **Messages sous les champs de connexion.** Les maquettes ne les écrivent pas. Textes retenus : « Saisissez votre adresse e-mail. », « Saisissez une adresse e-mail complète, par exemple prenom.nom@exemple.com. », « Saisissez votre mot de passe. ». Blocage : « Trop de tentatives pour cette adresse. Pour protéger le compte, la connexion est bloquée pendant 15 minutes. Vous pouvez aussi réinitialiser votre mot de passe. »
13. **Limitation des tentatives.** 5 échecs en 15 minutes pour une adresse depuis un même poste (IP), 20 échecs pour une adresse au total. Un collègue ne peut pas bloquer un compte depuis son poste en 5 essais. Les échecs sont comptés dans le journal d'audit (en ajout seul).
14. **Mot de passe oublié.** Non maquetté (§19). Une page explique pour l'instant de demander une nouvelle invitation à l'administrateur de division ; la réinitialisation par e-mail arrivera avec les e-mails de l'application.
15. **Pages des jalons suivants.** Chaque lien de navigation mène à une page « Écran en préparation » qui dit à quel jalon l'écran arrive, avec un retour à l'accueil. Les droits d'accès y sont déjà appliqués (404 sans la permission).

## Jalon 2 : saisie

16. **Flèche « semaine suivante ».** Les maquettes 02, 03 et 05 la montrent active sur la semaine courante. La règle du §9.2 la désactive quand la division interdit la saisie future (réglage par défaut) : le code suit la règle, avec la raison dans le nom du bouton. Une adresse de semaine future affiche une alerte et le bouton « Aller à la semaine courante ».
17. **« sauf s'il la rejette ».** Le texte du prototype 03 après soumission suppose le genre du manager. Texte retenu : « Elle n'est plus modifiable, sauf en cas de rejet. » À valider.
18. **Écran 05 dans les données de démonstration.** La maquette montre la semaine 12 d'Aïcha rejetée, alors que les maquettes 02 et 03 montrent la même semaine en brouillon. Le seed garde Aïcha en brouillon et place la fiche rejetée chez Kevin Fotso (même équipe, mêmes dates, même motif), avec ses propres projets. La maquette date aussi le rejet du lundi 23 mars, après l'horloge de démonstration (jeudi 19 mars).
19. **Textes non maquettés (§19).**
    - Ligne « fiche rejetée » du bloc À faire : « Semaine 12 rejetée par Samuel Etoga », « 16–20 mars 2026 · à corriger, puis à soumettre à nouveau », bouton « Corriger la semaine 12 ».
    - « Rien à faire pour l'instant. » sans action.
    - Carte « Semaine en cours » quand l'échéance est passée ou la fiche soumise ou validée : « Échéance dépassée depuis le … », « Soumise le … En attente de validation par … », « Validée le … », avec le bouton « Consulter la semaine ».
    - Bannière d'une fiche soumise ou validée : textes de la planche C2-B.
    - Retrait d'une ligne : « Ligne « … » retirée de la grille. » avec « Annuler ».
    - Raisons écrites à côté des boutons désactivés : « Tous vos projets ouverts à la saisie sont déjà dans la grille. », « La semaine 11 n'a aucune ligne à reprendre. », et sans projet affecté : « La saisie s'ouvre quand votre manager vous affecte à un projet. »
20. **Mobile.** La maquette 03-mobile n'a ni commentaire ni retrait de ligne. Le commentaire est affiché sous la liste du jour ; le retrait d'une ligne reste sur la grille desktop. Le pied de page mobile garde « TimeSheet · usage interne » (composant du jalon 1), absent de la maquette 02-mobile.
21. **Cellule vide et « 0 ».** Comme dans la maquette (« 0 » saisi le mardi, jeudi vide), un 0 saisi est enregistré et une cellule vide ne l'est pas. Sur mobile, une cellule vide s'affiche « 0 » dans le Quantity selector, comme la maquette.
22. **Cellule signalée.** Elle cesse d'être signalée dès que sa valeur change ; à la nouvelle soumission, tous les signalements sont levés. La réponse au manager est enregistrée dans le commentaire de la fiche et jointe à l'événement de soumission.
23. **Base locale du jalon 1.** Elle a été créée avec une version antérieure du seed : certaines activités de projet diffèrent de la maquette (ex. « Veille » et « Formation » au lieu de « Formation » seul). Les fiches de temps ont été ajoutées sans réinitialisation (le seed n'ajoute que ce qui manque). `npm run db:reset` aligne tout, mais efface la base locale : à lancer avec votre accord.
24. **Sélecteur de semaine du tableau de bord.** La semaine choisie passe dans l'adresse (`/tableau-de-bord?annee=2026&semaine=11`) ; « Mes projets » reste sur la semaine courante.
25. **Tests de bout en bout qui écrivent.** Remplacé au jalon 3 : voir le point 35.

## Jalon 3 : validation

26. **« En attente » dans la file.** La maquette 07 écrit « En attente » dans la colonne Statut ; la planche C4 n'admet que « En attente de validation » pour une fiche soumise. Le code suit C4 (un seul vocabulaire, §5.3). À confirmer.
27. **Données de démonstration de la file.** La maquette 07 montre six fiches en attente, dont celles d'Aïcha Ndongo et de Kevin Fotso ; les maquettes 02 à 05 montrent ces mêmes semaines en brouillon et rejetée. Le seed garde les écrans 02 à 05 et met quatre fiches en attente (Laure Bikoï, Sandrine Mvondo, Yannick Essomba en semaine 12, Ibrahim Njoya en 2e soumission pour la semaine 11). Les comptes « Validées (16) » correspondent à la maquette. Les heures de soumission du vendredi 20 mars tombent après l'horloge de démonstration (jeudi 19 mars, 09:42).
28. **Signalement de cellules (§19, non maquetté).** Quand le manager choisit « Rejeter la fiche », chaque cellule de la grille devient un bouton à bascule « Signaler la cellule … » ; une cellule signalée prend une bordure rouge et une croix. Le formulaire écrit le nombre de cellules signalées. Chez le collaborateur, la cellule est en erreur, le jour porte « À corriger » (écran 05). Capture à valider.
29. **Décision par défaut.** Le détail s'ouvre sur « Valider la fiche » (bouton primaire) ; la maquette montre « Rejeter » coché pour illustrer le motif. Le motif vide n'est pas bloqué par un bouton désactivé : le clic affiche « Saisissez le motif du rejet. » sous le champ, avec le focus (§5.5).
30. **Rejet groupé.** Même règle : le bouton « Rejeter » de la modale reste actif et le motif manquant s'écrit sous le champ.
31. **Portée.** Un manager voit ses rattachés directs, un owner toute sa division (§7). La validation N+2 facultative (`ownerValidation`) n'a pas d'écran : désactivée par défaut, elle sera branchée avec les réglages de workflow (jalon 6).
32. **Relance des validateurs.** `POST /api/taches/relances`, protégée par `TASKS_SECRET`, à appeler chaque jour ouvré par le planificateur de l'hébergement (cron du conteneur, ordonnanceur de la plateforme). Une relance par soumission, après `reminderAfterWorkingDays` jours ouvrés (3 par défaut, jours fériés exclus). Validateur absent (compte désactivé) : l'owner, si la division délègue au N+2 (`delegateToOwner`, actif par défaut). Chaque relance crée un événement « Relance envoyée » et une ligne du journal d'audit.
33. **E-mails.** Validation et rejet préviennent le collaborateur (préférences du jalon 6, actives par défaut). Un échec d'envoi n'annule pas la décision : il est écrit dans les journaux du serveur. Liens vers `APP_URL`. Nodemailer 10.0.10 (les versions ≤ 10.0.5 ont des failles connues) ; Auth.js déclare Nodemailer 8 en dépendance pair facultative, pour un fournisseur e-mail que l'application n'utilise pas : `overrides` dans `package.json`.
34. **Historique.** La création du brouillon est désormais enregistrée (« Brouillon créé », planche 08). Les fiches déjà en base ont reçu cet événement à 09:05 le lundi de leur semaine.
35. **Tests de bout en bout.** Ils écrivent dans une « Division de test » à part (comptes `*.e2e@exemple.com`), remise à zéro avant chaque exécution ; la division CX Expertise n'est plus jamais modifiée par les tests.
36. **Statut HTTP des écrans avec état de chargement.** Avec `loading.tsx`, Next envoie la page en flux et le statut part avant les contrôles de la page. Les permissions et l'existence de l'objet sont donc vérifiées dans un `layout.tsx` du segment, pour garder un vrai 404.

## Jalon 4 : projets, reporting, vue consolidée

37. **Libellés de la vue consolidée absents de la maquette 11.** Une personne sans équipe est comptée dans une ligne « Sans équipe » du tableau par équipe. Quand toutes les fiches soumises sont validées, l'indicateur « Fiches validées » écrit « Aucune fiche en attente » (repris de la maquette 07). À confirmer.
38. **Chiffres de démonstration des écrans 9 à 11.** La mise en page suit les maquettes, mais les heures du seed ne reproduisent pas leurs totaux : par exemple « Veille et formation » 585 h consommées au lieu de 148 h (écran 9), 624 h saisies au lieu de 640 h du 2 au 20 mars (écran 10), 8 dérives au lieu de 4 (écran 11). Le seed génère l'historique depuis janvier pour toute la division ; les maquettes ne sont pas cohérentes entre elles sur ces totaux. À arbitrer : ajuster le seed écran par écran, ou garder des données cohérentes entre les écrans.
39. **Projets archivés.** L'interrupteur « Afficher les projets archivés » (§9.4) n'est pas sur la maquette 09 : il est placé sous les filtres. Un projet archivé porte « Archivé » après son code. L'archivage se défait par « Annuler » dans le message, sans confirmation.
40. **Flèche « semaine suivante » de la vue division.** La maquette 11 la montre active sur la semaine courante ; elle est désactivée, avec la raison dans le nom du bouton, car aucune semaine future n'est consultable (même règle que le point 16).
41. **Exports.** CSV (UTF-8, point-virgule, virgule décimale), Excel et PDF reprennent les filtres de l'écran (axe, période, périmètre) ; le nom du fichier est `Reporting_2026-S10_2026-S12`. Le PDF est imprimé par Chromium côté serveur (`playwright-core`), mécanisme repris pour la fiche de présence au jalon 5 : l'hébergement doit fournir Chromium (`npx playwright install chromium`).
42. **Tests de bout en bout du jalon 4.** Les écritures sur les projets (création, statut, archivage) passent par la division de test ; la remise à zéro supprime les projets créés par les tests et rend leur statut aux projets fixes. Les relances de la vue division ne sont pas déclenchées par les tests, pour ne pas écrire dans CX Expertise.
43. **Cases des membres (09-Projets-creation).** La maquette met les noms des membres en graisse normale ; le composant ODS `Checkbox` garde le gras de Boosted (`label`), comme partout ailleurs dans l'application. Laissé tel quel (composants ODS tels quels) : à confirmer.
