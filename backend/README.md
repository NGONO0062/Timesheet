# TimeSheet : API (.NET)

Backend de la réécriture sur la stack Orange (voir `docs/reecriture.md`) : .NET 10, architecture DDD générée par [Craftsman](https://wrapt.dev) 0.29, CQRS avec MediatR 12, Entity Framework Core sur PostgreSQL.

## Prérequis

- SDK .NET 10 ; outils : `dotnet tool install -g craftsman --version 0.29.0` et `dotnet tool install -g dotnet-ef --version 10.0.14`.
- Craftsman est compilé pour .NET 8 : le lancer avec `DOTNET_ROLL_FORWARD=Major` s'il n'y a que .NET 10.
- PostgreSQL sur `localhost:5432`, utilisateur `timesheet` (`docker compose up -d` à la racine crée la base `timesheet_api`). Sans Docker : `createdb -h localhost -U timesheet timesheet_api` une fois (les tests recréent les leurs).

## Commandes (depuis `backend/`)

- Compiler : `dotnet build TimeSheet.slnx`
- Tests (unitaires, intégration, fonctionnels) : `dotnet test TimeSheet.slnx`. Les tests d'intégration et fonctionnels recréent leurs bases (`timesheet_api_integration`, `timesheet_api_functional`) sur `TIMESHEET_TEST_DB`, sinon sur le PostgreSQL local. Pas de Docker.
- Lancer l'API : `dotnet run --project TimeSheet.Api/src/TimeSheet.Api` (environnement `Development`, base `timesheet_api`, migrations appliquées au démarrage).
- Données de démonstration : `dotnet run --project TimeSheet.Api/src/TimeSheet.Api -- --seed` (migrations, puis comptes du seed ; `SEED_PASSWORD`). Base de développement à recréer : `dropdb` puis `createdb timesheet_api`.
- E-mails : SMTP par `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` ; en développement, Mailpit (`localhost:1025`, interface http://localhost:8025). Un échec d'envoi n'annule jamais l'action. Les tests fonctionnels gardent les messages sans les envoyer.
- Tâche planifiée, chaque jour ouvré : `curl -X POST -H "Authorization: Bearer $TASKS_SECRET" https://…/api/v1/taches/relances` (relance des validateurs). Le vendredi à 12:00 : même appel sur `…/api/v1/taches/rappels-saisie` (rappel de saisie, préférence de l'écran 14). Sans `TASKS_SECRET` d'au moins 32 caractères, la route refuse tout appel (il n'est pas fourni en développement).
- PDF (exports, fiche de présence) : Chromium par Microsoft.Playwright. À installer une fois par poste ou par image, après la compilation : `TimeSheet.Api/src/TimeSheet.Api/bin/Debug/net10.0/.playwright/node/win32_x64/node.exe TimeSheet.Api/src/TimeSheet.Api/bin/Debug/net10.0/.playwright/package/cli.js install chromium --only-shell` (ou `pwsh bin/…/playwright.ps1 install chromium --only-shell`).
- Fichiers signés (PDF des fiches de présence) : dossier `STORAGE_DIR`, sinon `storage/` à côté de l'API (ignoré par git). Un PDF signé stocké n'est jamais régénéré : son empreinte SHA-256 est gardée avec la signature.
- Base des tests de bout en bout : `dotnet run --project TimeSheet.Api/src/TimeSheet.Api -- --seed-fresh` recrée la base désignée par la chaîne de connexion avec la démonstration et la division de test ; refusé si son nom ne finit pas par `_e2e`. Lancé par `frontend/e2e/global-setup.ts`.
- Nouvelle migration : `dotnet ef migrations add <Nom> --project TimeSheet.Api/src/TimeSheet.Api --output-dir Databases/Migrations`.

## Écarts avec la sortie de Craftsman

- Cible .NET 10 au lieu de .NET 8 (fin de support le 10 novembre 2026) ; paquets mis à jour.
- MediatR reste en 12.x et FluentAssertions en 7.x : les versions suivantes sont sous licence commerciale.
- Pas de Testcontainers ni d'OpenTelemetry/Jaeger (Docker absent des postes ; observabilité à définir avec le guide Orange).
- Section de configuration `TimeSheetApi` (Craftsman lisait `TimeSheet.Api` mais écrivait `TimeSheetApi`).
