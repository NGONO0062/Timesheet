# TimeSheet

Application interne Orange Cameroun : gestion et suivi des projets, temps de travail hebdomadaires, validation par le manager, pilotage, tâches, administration multi-divisions.

- Spécification complète : `PROMPT.md`. Maquettes et captures de référence : `design/`.
- Règles de l'équipe (design system, sécurité, méthode) : `CLAUDE.md`.
- Architecture : `docs/architecture.md`. Historique de la réécriture et écarts assumés : `docs/reecriture.md`.
- Choix faits pendant le développement et points à confirmer : `docs/questions-ouvertes.md`. Écarts avec ODS (Boosted) : `docs/ecarts-ods.md`. Règles visuelles v2 : `docs/design-v2.md`.
- Mise en production et exploitation : `docs/exploitation.md`. Staging sur un serveur : `docs/staging.md`.

## Pile

- `backend/` : API .NET 10 (architecture générée par Craftsman, CQRS avec MediatR 12, Entity Framework Core sur PostgreSQL). Voir `backend/README.md`.
- `frontend/` : interface React 19 (Vite, React Router 7, TanStack Query, Tailwind 4, HeadlessUI, Feature-Sliced Design). Voir `frontend/README.md`.
- `deploy/` : image de production (`deploy/Dockerfile`, l'API sert aussi l'interface) et staging (Docker Compose, Caddy).

## Démarrer en local

Prérequis : SDK .NET 10, Node.js 22, PostgreSQL et Mailpit (par `docker compose up -d`, ou installés à part).

```bash
docker compose up -d                       # PostgreSQL (5432) et Mailpit (1025, interface http://localhost:8025)

cd backend
dotnet build TimeSheet.slnx
# Chromium pour les PDF, une fois par poste (voir backend/README.md)
dotnet run --project TimeSheet.Api/src/TimeSheet.Api -- --seed   # migrations et données de démonstration
dotnet run --project TimeSheet.Api/src/TimeSheet.Api              # API sur http://localhost:5000

cd ../frontend
npm install
npm run dev                                # http://localhost:5173 (/api relayé vers l'API)
```

Les données de démonstration reproduisent les maquettes : division CX Expertise, semaine 12 de 2026. En développement, l'horloge de démonstration (`TIMESHEET_NOW`, `backend/…/appsettings.Development.json`) part du jeudi 19 mars 2026 ; elle est toujours vide en production.

### Comptes de démonstration

Mot de passe : `SEED_PASSWORD` de `appsettings.Development.json`. Tous les noms sont fictifs.

| Compte | Rôle | Écrans principaux |
|---|---|---|
| aicha.ndongo@exemple.com | Staff | Tableau de bord, saisie, tâches |
| samuel.etoga@exemple.com | Manager | Validation, projets, reporting |
| brigitte.mbarga@exemple.com | Owner | Vue consolidée de la division |
| paul.tchouta@exemple.com | Admin de division | Administration de la division |
| rose.ekambi@exemple.com | Admin plateforme | Divisions, onboarding, journal d'audit |

`DEMO_PROFILES` (actif en développement) affiche ces profils sur l'écran de connexion. Les e-mails (invitations, validations, rappels) arrivent dans Mailpit : http://localhost:8025.

## Commandes

| Commande | Rôle |
|---|---|
| `dotnet test TimeSheet.slnx` (dans `backend/`) | Tests unitaires (règles métier) et fonctionnels (API sur une base de test recréée), dont l'isolation entre divisions. |
| `npm run check` (dans `frontend/`) | TypeScript, ESLint (frontières des couches), contrôle de style, tests unitaires. |
| `npm run test:e2e` (dans `frontend/`) | Tests de bout en bout et axe-core (Playwright, bureau 1280 px et mobile 375 px), sur une pile à eux : base `timesheet_api_e2e` recréée, API sur le port 5100, interface sur le 5174. La base de développement n'est jamais touchée. |
| `npm run dev`, puis http://localhost:5173/design | Chaque composant dans tous ses états (planches C1 à C4). |
| `docker build -f deploy/Dockerfile -t timesheet .` | Image de production. |

## Ce que fait l'application

| # | Écran | Route | Pour qui |
|---|---|---|---|
| 1 | Connexion, mot de passe oublié, invitation | `/connexion`, `/mot-de-passe-oublie`, `/invitation/:jeton` | Tous |
| 2 | Tableau de bord | `/tableau-de-bord` | Qui saisit ses temps |
| 3–5 | Saisie hebdomadaire (par jour), soumission, fiche rejetée | `/saisie/:annee/:semaine` | Qui saisit ses temps |
| 7–8 | File de validation, détail d'une fiche | `/validation`, `/validation/:id` | Managers, owners |
| 9 | Projets | `/projets` | Managers, owners, admin de division |
| 10 | Reporting et exports | `/reporting` | Managers, owners, admin de division |
| 11 | Vue consolidée | `/division` | Owners, admin de division |
| 12 | Administration de la division | `/administration` | Admin de division |
| 13 | Administration plateforme, onboarding, journal | `/plateforme` | Admin plateforme |
| 14 | Paramètres | `/parametres` | Tous |
| 15 | Tâches (tableau Kanban d'un projet) | `/taches` | Membres des projets, ceux qui les gèrent |

Les permissions se règlent par division (écran 12) ; la navigation et chaque contrôle de l'API lisent les permissions effectives, jamais le nom du rôle.
