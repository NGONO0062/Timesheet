# Architecture

## Pile

- **API** (`backend/`) : .NET 10, solution générée par Craftsman (DDD), CQRS avec MediatR 12 (une commande ou une requête par action ou lecture d'écran), Entity Framework Core sur PostgreSQL, MailKit pour les e-mails, Microsoft.Playwright (Chromium) pour les PDF. Tests : xUnit, FluentAssertions 7 (unitaires et fonctionnels sur une base recréée).
- **Interface** (`frontend/`) : React 19, TypeScript strict, Vite, React Router 7, TanStack Query 5, Zustand, Tailwind 4 (thème limité aux valeurs des maquettes), HeadlessUI. Graphiques en SVG, sans bibliothèque. Tests : Vitest, Playwright et axe-core.
- **Production** : une image (`deploy/Dockerfile`) ; l'API sert aussi les fichiers de l'interface, sur la même origine (cookie de session, pas de CORS).

Choix et écarts avec le guide Orange : `docs/reecriture.md`.

## API

| Dossier (`backend/TimeSheet.Api/src/TimeSheet.Api/`) | Contenu | Règle |
|---|---|---|
| `Controllers/v1/` | Routes `/api/v1/…` : lecture des entrées, envoi d'une commande ou d'une requête MediatR. | Aucune règle métier dans un contrôleur. |
| `Domain/<Domaine>/` | Entités et règles pures (`*Rules.cs`) : semaines ISO, saisie, validation, fiche de présence, projets, reporting, administration, plateforme, tâches. | Testées sans base (`tests/…UnitTests`). |
| `Domain/<Domaine>/Features/` | Gestionnaires MediatR : portée, permission, lecture et écriture des données, journal d'audit. | Chaque requête relit l'utilisateur connecté (`IViewerAccessor`) et filtre sur sa division. |
| `Databases/` | `TimeSheetDbContext`, configurations EF, migrations, seeds (démonstration, tests de bout en bout, premier admin plateforme). | Migrations appliquées au démarrage, sous verrou PostgreSQL. |
| `Services/` | Accès (utilisateur connecté, portée), audit, e-mails (gabarits purs et envoi), exports (CSV, Excel, PDF), stockage des PDF signés, horloge. | |
| `Exceptions/`, `Middleware/` | Erreurs : 404 (ressource absente ou hors portée), 422 avec un code et les champs en erreur ; en-têtes de sécurité. | L'interface traduit les codes en messages. |

## Interface (Feature-Sliced Design)

`src/app` (démarrage, routes, gardes, thème) > `pages` > `widgets` > `features` > `entities` > `shared`. Une couche n'importe que les couches en dessous d'elle (règle ESLint).

| Couche | Contenu |
|---|---|
| `entities/` | Par domaine : types de l'API, requêtes et écritures TanStack Query, règles d'affichage pures testées. |
| `features/` | Actions réutilisables : connexion, saisie de la semaine, signature, champs de configuration d'une division, édition de projet. |
| `widgets/` | Blocs d'écran partagés : coque, sélecteur de semaine, saisie par jour, graphiques, fiche de présence, journal d'audit, onglets de validation. |
| `pages/` | Un dossier par écran (ou groupe d'écrans). |
| `shared/` | Composants ODS reproduits en Tailwind (`ui/`), accès à l'API (`api/`), textes (`i18n/fr.ts`), formats (`lib/format.ts`), statuts (`lib/status.ts`). |

Le contrôle de style (`frontend/scripts/check-styles.mjs`) refuse les valeurs arbitraires, les bordures autres que 2 px, les opacités, les dégradés, les couleurs en dur et les styles en ligne.

## Contrôles d'accès

1. Session par cookie `HttpOnly` (`SameSite=Strict`, 8 heures) ; toute route de l'API exige une session, sauf celles marquées publiques (connexion, liens, tâches planifiées protégées par `TASKS_SECRET`).
2. L'utilisateur est relu en base à chaque requête : un compte désactivé, une division suspendue ou un mot de passe changé ferment l'accès tout de suite.
3. Les permissions effectives (matrice par défaut du §7, puis réglages de la division) pilotent la navigation et chaque contrôle de l'API. Une ressource hors de la portée répond 404.
4. L'interface masque ce qui serait refusé (gardes de routes, « Page introuvable ») ; la décision reste à l'API.

## Horloges

- Règles métier : `TimeProvider` de l'application (`Services/AppClock.cs`). `TIMESHEET_NOW` fixe le point de départ en démonstration, puis le temps avance.
- Journal d'audit : `At` suit l'horloge de l'application (affichage, filtres) ; `RecordedAt` est l'heure réelle (fenêtres de limitation, liens à usage unique).

## E-mails et tâches

- Gabarits purs dans `Services/Mail/MailTemplates.cs` (texte brut et HTML sobre, sans image), envoi par `MailSender` (MailKit). Préférences de notification par utilisateur (écran 14).
- Tâches planifiées : `POST /api/v1/taches/relances` (validateurs) et `POST /api/v1/taches/rappels-saisie` (vendredi 12:00). Voir `docs/exploitation.md`.

## Données de démonstration et de test

- `Databases/Seed/DemoSeed.cs` (`--seed`) : division CX Expertise et données des maquettes (semaine 12 de 2026), division en onboarding et journal de la planche 13. Refusé en production.
- `Databases/Seed/E2eSeed.cs` : divisions des tests de bout en bout (« Division de test », « Division d'administration de test »), dans la base `timesheet_api_e2e` recréée à chaque exécution (`--seed-fresh`, refusé sur toute autre base). CX Expertise n'est jamais modifiée par les tests.
- Tests fonctionnels : chaque test crée sa propre division, dans une base recréée au début de l'exécution.
