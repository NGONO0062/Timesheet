# TimeSheet

Application interne Orange Cameroun : projets, temps de travail hebdomadaires, validation par le manager, fiche de présence RH des stagiaires, pilotage, administration multi-divisions.

- Spécification complète : `PROMPT.md`. Maquettes et captures de référence : `design/`.
- Règles de l'équipe (design system, sécurité, méthode) : `CLAUDE.md`.
- Choix faits pendant le développement et points à confirmer : `docs/questions-ouvertes.md`. Écarts avec Boosted : `docs/ecarts-ods.md`.
- Architecture : `docs/architecture.md`. Mise en production et exploitation : `docs/exploitation.md`.

## Démarrer en local

Prérequis : Node.js 22 (Prisma 6 tant que Node < 22.12), Docker.

```bash
npm install
npx prisma generate
npx playwright install chromium   # tests de bout en bout et PDF (fiche de présence, exports)
cp .env.example .env              # puis renseigner AUTH_SECRET (npx auth secret)
docker compose up -d              # PostgreSQL (5432) et Mailpit (1025, interface http://localhost:8025)
npm run db:migrate
npm run db:seed
npm run dev                       # http://localhost:3000
```

Les données de démonstration reproduisent les maquettes : division CX Expertise, semaine 12 de 2026. Pour retrouver les écrans tels qu'en maquette, mettez `TIMESHEET_NOW="2026-03-19T09:42:00Z"` dans `.env` (horloge de démonstration ; toujours vide en production).

### Comptes de démonstration

Mot de passe : `SEED_PASSWORD` de `.env`. Tous les noms sont fictifs.

| Compte | Rôle | Écrans principaux |
|---|---|---|
| aicha.ndongo@exemple.com | Staff, stagiaire | Tableau de bord, saisie, fiche de présence |
| samuel.etoga@exemple.com | Manager | Validation, projets, reporting |
| brigitte.mbarga@exemple.com | Owner | Vue consolidée de la division |
| paul.tchouta@exemple.com | Admin de division | Administration de la division |
| rose.ekambi@exemple.com | Admin plateforme | Divisions, onboarding, journal d'audit |

`DEMO_PROFILES="true"` affiche ces profils sur l'écran de connexion (démonstration seulement).

Les e-mails (invitations, validations, rappels, fiche de présence aux RH) arrivent dans Mailpit : http://localhost:8025.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement ; `/design` expose chaque composant dans tous ses états. |
| `npm run check` | TypeScript, ESLint, contrôle de style (§4.2), tests unitaires. |
| `npm test` | Tests unitaires (règles métier pures, Vitest). |
| `npm run test:int` | Tests d'intégration sur la base du seed, dont l'isolation entre divisions. |
| `npm run test:e2e` | Tests de bout en bout et axe-core (Playwright, desktop 1280 px et mobile 375 px). |
| `npm run lint:styles` | Contrôle de style seul : palette, graisses, bordures, rayons, ombres, opacités. |
| `npm run db:migrate` / `npm run db:seed` | Migrations et données de démonstration. |
| `npm run db:reset` | Repart d'une base neuve (le journal d'audit refuse les suppressions : la base est recréée). |
| `npm run build` | Build de production (sortie `standalone`, voir le `Dockerfile`). |

Les tests de bout en bout écrivent seulement dans des divisions de test (« Division de test », « Division d'administration de test », comptes `*.e2e@exemple.com`), remises à zéro avant chaque exécution. CX Expertise n'est jamais modifiée.

## Ce que fait l'application

| # | Écran | Route | Pour qui |
|---|---|---|---|
| 1 | Connexion, mot de passe oublié, invitation | `/connexion`, `/mot-de-passe-oublie`, `/invitation/[jeton]` | Tous |
| 2 | Tableau de bord | `/tableau-de-bord` | Qui saisit ses temps |
| 3–5 | Saisie hebdomadaire, soumission, fiche rejetée | `/saisie/[annee]/[semaine]` | Qui saisit ses temps |
| 6 | Fiche de présence RH | `/fiche-presence/[annee]/[mois]` | Stagiaires ; superviseur dans `/validation/presence` |
| 7–8 | File de validation, détail d'une fiche | `/validation`, `/validation/[id]` | Managers, owners |
| 9 | Projets | `/projets` | Managers, owners, admin de division |
| 10 | Reporting et exports | `/reporting` | Managers, owners, admin de division |
| 11 | Vue consolidée | `/division` | Owners, admin de division |
| 12 | Administration de la division | `/administration` | Admin de division |
| 13 | Administration plateforme, onboarding, journal | `/plateforme` | Admin plateforme |
| 14 | Paramètres | `/parametres` | Tous |

Les permissions se règlent par division (écran 12) ; la navigation et chaque contrôle serveur lisent les permissions effectives, jamais le nom du rôle.
