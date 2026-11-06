# Réécriture sur la stack Orange

Décision du 6 novembre 2026 : TimeSheet est réécrite avec la stack recommandée par le guide interne d'Orange (`devdocs.apps.dev.orange.local`). L'application actuelle (Next.js, Prisma) reste dans le dépôt comme référence fonctionnelle jusqu'à ce que la nouvelle fasse au moins autant ; elle est supprimée au dernier jalon.

La spécification (`PROMPT.md`) et les maquettes (`design/`) ne changent pas : mêmes écrans, mêmes libellés, mêmes règles métier, mêmes règles visuelles. Seule la technique change.

## Stack

| Couche | Guide Orange | Choix pour TimeSheet |
|---|---|---|
| Backend | .NET 8+ | .NET 10 (support long, jusqu'en novembre 2028) |
| Architecture backend | Craftsman (DDD), CQRS, MediatR | Solution générée par Craftsman ; une commande ou une requête MediatR par action ou lecture d'écran |
| Base de données | — (section non lue) | PostgreSQL, gardé ; Entity Framework Core |
| Frontend | React 18+, TypeScript, Vite | React 19, TypeScript strict, Vite |
| Routage, données, état | React Router v6, TanStack Query, Zustand | React Router **v7** (7.18), TanStack Query 5, Zustand 5 : voir « Écarts » |
| Style | TailwindCSS, HeadlessUI | Idem ; maquettes ODS reproduites (voir « Règles visuelles ») |
| Organisation du frontend | Feature-Sliced Design | `app`, `pages`, `widgets`, `features`, `entities`, `shared` |

### Ce qui se réutilise

- **Règles métier pures** (`lib/timesheet`, `lib/attendance`, `lib/tasks`, `lib/admin/rules.ts`…) et leurs tests : traduites en C# dans le domaine, test pour test.
- **Écrans et composants React** : le JSX et l'accessibilité (rôles, libellés, clavier) se reprennent ; le style passe de Boosted à Tailwind, les données de l'action serveur à TanStack Query.
- **Textes** (`lib/i18n/fr.ts`) et **formats** (`lib/format.ts`) : repris tels quels côté frontend.
- **Tests de bout en bout** (`e2e/`) : ils testent l'écran par les rôles et les libellés, pas la technique ; ils servent de contrôle de parité.
- **Gabarit HTML de la fiche de présence et des exports** : gardé, rendu en PDF par Playwright pour .NET (licence Apache), pour une mise en page identique.

### Ce qui se refait

Tout le serveur : authentification, permissions et portée par division, accès aux données, journal d'audit en ajout seul, e-mails (MailKit), PDF, exports CSV et Excel, tâches planifiées, liens d'invitation et de réinitialisation, et les règles de sécurité de la revue du 6 novembre (point 85 des questions ouvertes).

Aucune donnée réelle n'existe encore (aucun déploiement) : pas de migration de données, le seed est réécrit.

## Règles visuelles avec Tailwind

Les règles de `CLAUDE.md` restent ; la règle « pas de Tailwind, pas de bibliothèque de composants tierce » est remplacée par Tailwind et HeadlessUI. La configuration de Tailwind ne contient que les valeurs permises, donc une valeur interdite n'existe pas :

- couleurs : les 12 de `CLAUDE.md` (plus les 4 couleurs de séries, réservées aux graphiques) ;
- espacements : 0, 5, 10, 20, 30, 60 px ;
- graisses : 400 et 700 ;
- bordures : 2 px ; rayons : 6 et 8 px ;
- ombres, dégradés et opacités : retirés du thème (sauf le voile de modale à 50 %).

Le contrôle de style (`scripts/check-styles.mjs`) est adapté pour refuser les valeurs arbitraires (`p-[7px]`, `text-[#123456]`…). HeadlessUI fournit le comportement accessible (fenêtres, menus, listes, onglets) ; l'apparence suit les planches C1 à C4.

## Jalons

Même méthode qu'avant : un jalon à la fois ; tests, comparaison avec `design/captures/`, commit, résumé, puis accord.

0. **Socle.** .NET 10 et Craftsman installés ; solution backend générée (PostgreSQL, tests) ; application Vite avec React Router, TanStack Query, Zustand, Tailwind verrouillé sur les règles visuelles, HeadlessUI ; arborescence Feature-Sliced Design ; contrôle de style adapté ; page `/design` qui reproduit les planches C1 à C4. Commandes de contrôle uniques pour les deux côtés.
1. **Accès.** Authentification, sessions (fermées au changement de mot de passe), divisions, rôles, permissions, portée par division sur chaque requête, navigation par rôle, mises en page bureau et mobile, journal d'audit, seed. Écran 1.
2. **Saisie.** Écrans 2 à 5 et versions mobiles, sauvegarde automatique.
3. **Validation.** Écrans 7 et 8, rejet, nouvelle soumission, relances, e-mails.
4. **Pilotage.** Écrans 9 à 11, exports CSV, Excel et PDF.
5. **Fiche de présence.** Écran 6, génération mensuelle, signatures, PDF signé, e-mail aux RH, vue du superviseur.
6. **Administration de division et Paramètres.** Écrans 12 et 14, invitations, réinitialisation.
7. **Plateforme.** Écran 13, onboarding, journal d'audit.
8. **Tâches.** Écran 15, tableau Kanban, glisser-déposer et clavier.
9. **Parité et bascule.** Toute la suite de bout en bout passe sur la nouvelle application ; image de production, documentation (`README.md`, `docs/`) ; l'application Next.js est supprimée.

## Points ouverts

1. **Sections du guide non lues** : base de données, authentification (SSO Orange ?), déploiement (OpenShift ?), fin de la liste frontend. Elles peuvent changer les jalons 0, 1 et 9.
2. **Authentification.** Craftsman prévoit par défaut un fournisseur d'identité externe (OpenID Connect). En attendant le SSO Orange : e-mail et mot de passe gérés par l'API, session par cookie `HttpOnly`, comme aujourd'hui.
3. **Tests d'intégration.** Les gabarits de Craftsman lancent PostgreSQL par Testcontainers, qui exige Docker, absent de ce poste : ils visent ici le PostgreSQL local, avec une base dédiée.
4. **React Router v7 au lieu de v6** : toutes les versions 6 ont une faille de redirection ouverte (`<Link>`, `useNavigate`, GHSA-wrjc-x8rr-h8h6) corrigée seulement à partir de la 7.18.0. La v7, en mode bibliothèque (routeur côté navigateur), garde l'API de la v6. Écart à faire valider.

## Écarts et choix du jalon 0

- **.NET 10** au lieu de .NET 8 : Craftsman génère du .NET 8, dont le support s'arrête le 10 novembre 2026 ; la solution est reciblée et les paquets mis à jour (aucun paquet vulnérable, dépendances indirectes comprises).
- **Licences** : MediatR reste en 12.5 et FluentAssertions en 7.2, dernières versions libres (Apache 2.0) ; les suivantes sont payantes pour une entreprise.
- **Tailwind 4** : thème dans `frontend/src/app/styles/index.css`, valeurs par défaut retirées ; contrôle `frontend/scripts/check-styles.mjs`.
- **npm** : `frontend/.npmrc` désactive l'installation automatique des dépendances de pairs (bug de npm 10 avec Vitest 5) ; toutes les dépendances sont déclarées.
- **TypeScript 6.0** (comme l'application actuelle) : la 7 n'est pas encore prise en charge par typescript-eslint.
