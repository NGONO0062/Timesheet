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
5. **Signalement de cellules dans la planche C2-B.** La planche place le message de la cellule signalée à gauche du bouton « Soumettre à nouveau ». Le composant de grille place les messages d'erreur sous le tableau, et l'écran place le bouton en dessous. À valider sur l'écran 05 au jalon 2.
6. **Git absent de la machine.** La méthode demande un commit par jalon. Git n'est pas installé : le dépôt n'est pas initialisé.
7. **Polices.** Helvetica Neue n'est pas embarquée (licence) : la pile retombe sur Arial sous Windows. Les captures de comparaison sont faites dans les mêmes conditions.
