# TimeSheet : API (.NET)

Backend de la réécriture sur la stack Orange (voir `docs/reecriture.md`) : .NET 10, architecture DDD générée par [Craftsman](https://wrapt.dev) 0.29, CQRS avec MediatR 12, Entity Framework Core sur PostgreSQL.

## Prérequis

- SDK .NET 10 ; outils : `dotnet tool install -g craftsman --version 0.29.0` et `dotnet tool install -g dotnet-ef --version 10.0.14`.
- Craftsman est compilé pour .NET 8 : le lancer avec `DOTNET_ROLL_FORWARD=Major` s'il n'y a que .NET 10.
- PostgreSQL sur `localhost:5432`, utilisateur `timesheet` (le même que l'application actuelle). Créer une fois la base de développement : `createdb -h localhost -U timesheet timesheet_api` (les tests recréent les leurs).

## Commandes (depuis `backend/`)

- Compiler : `dotnet build TimeSheet.slnx`
- Tests (unitaires, intégration, fonctionnels) : `dotnet test TimeSheet.slnx`. Les tests d'intégration et fonctionnels recréent leurs bases (`timesheet_api_integration`, `timesheet_api_functional`) sur `TIMESHEET_TEST_DB`, sinon sur le PostgreSQL local. Pas de Docker.
- Lancer l'API : `dotnet run --project TimeSheet.Api/src/TimeSheet.Api` (environnement `Development`, base `timesheet_api`, migrations appliquées au démarrage).
- Nouvelle migration : `dotnet ef migrations add <Nom> --project TimeSheet.Api/src/TimeSheet.Api --output-dir Databases/Migrations`.

## Écarts avec la sortie de Craftsman

- Cible .NET 10 au lieu de .NET 8 (fin de support le 10 novembre 2026) ; paquets mis à jour.
- MediatR reste en 12.x et FluentAssertions en 7.x : les versions suivantes sont sous licence commerciale.
- Pas de Testcontainers ni d'OpenTelemetry/Jaeger (Docker absent des postes ; observabilité à définir avec le guide Orange).
- Section de configuration `TimeSheetApi` (Craftsman lisait `TimeSheet.Api` mais écrivait `TimeSheetApi`).
