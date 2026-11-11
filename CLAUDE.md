# TimeSheet

Application interne Orange Cameroun : gestion et suivi des projets, temps de travail. Spécification d'origine dans `PROMPT.md`. Maquettes dans `design/`.

La partie RH (fiche de présence, stages, signature, envoi aux RH) a été retirée le 11 novembre 2026 : ne pas la réintroduire sans décision. La saisie du temps et sa validation restent, parce qu'elles donnent le consommé de chaque projet (`docs/reecriture.md`).

## Règles à ne jamais enfreindre

- Couleurs : uniquement `#ff7900`, `#f16e00`, `#000000`, `#ffffff`, `#999999`, `#595959`, `#dddddd`, `#fafafa`, `#228722`, `#cd3c14`, `#ffd200`, `#4170d8`.
- Graphiques seulement : quatre couleurs de séries, dans cet ordre, `#237eca`, `#198c51`, `#6e4aa7`, `#d573bb`. Jamais ailleurs.
- `#ff7900` sert à l'état actif seulement. Le primaire est `#f16e00`. L'état actif est un trait de 5 px (`accent-mark`), jamais un aplat ; les éléments sélectionnés passent en noir (`docs/design-v2.md`).
- Graisses 400 et 700. Jamais 500 ni 600. Le gras pour les titres, chiffres clés, libellés, étiquettes et actions ; valeurs et cellules en 400.
- Espacements : 0, 5, 10, 20, 30, 60 px.
- Bordures de 2 px, jamais 1 px. Rayon 6 px, 8 au maximum.
- Aucune ombre, aucun dégradé, aucune opacité réduite (seul le voile de modale est à 50 %).
- Survol par inversion de contraste. Désactivé opaque.
- Jamais d'information portée par la couleur seule. Liens soulignés.
- Composants ODS reproduits en Tailwind tels que les planches les montrent ; écarts notés dans `docs/ecarts-ods.md`.
- Statuts : uniquement les libellés de la planche `C4-Etiquettes-statut`, via un composant unique (`<StatusBadge>`). Une seule étiquette par objet.
- Un seul bouton primaire par écran. Action réversible : pas de confirmation, un message avec « Annuler ».
- Pas de logo. Le mot « TimeSheet », « Time » en `#f16e00`, « Sheet » en blanc sur fond noir.
- Pas de bibliothèque de graphiques. Tailwind et HeadlessUI seulement, thème limité aux valeurs ci-dessus ; pas d'autre bibliothèque de composants.
- Chaque requête de l'API filtre sur la division de l'utilisateur connecté. Aucune donnée ne traverse d'une division à l'autre.
- Interface en français. Libellés repris des maquettes mot pour mot.
- Aucune donnée réelle ni secret dans le dépôt.
- MediatR reste en 12.x et FluentAssertions en 7.x (versions suivantes sous licence payante).

## Méthode

- Un changement à la fois : tests, comparaison avec `design/captures/`, commit, résumé, puis attendre l'accord.
- Une question ouverte se note dans `docs/questions-ouvertes.md`. Un écart avec ODS se note dans `docs/ecarts-ods.md`. Les choix de la réécriture sont dans `docs/reecriture.md`.

## Commandes

- Services de développement : `docker compose up -d` (PostgreSQL sur 5432, Mailpit sur 1025 / interface 8025). Poste sans Docker : PostgreSQL et Mailpit installés à part, sur les mêmes ports.
- API (`backend/`) : `dotnet build TimeSheet.slnx`, `dotnet test TimeSheet.slnx` (bases de test recréées sur le PostgreSQL local, `TIMESHEET_TEST_DB`), `dotnet run --project TimeSheet.Api/src/TimeSheet.Api` (port 5000). Données de démonstration : `… -- --seed` ; base de développement à recréer : `dropdb` puis `createdb timesheet_api`. Chromium pour les PDF : `backend/README.md`.
- Interface (`frontend/`) : `npm run dev` (port 5173, `/api` relayé vers le port 5000 ; composants sur `/design`), `npm run check` (TypeScript, ESLint, contrôle de style, tests unitaires). Sous Windows, lancer les tests depuis PowerShell, pas depuis Git Bash.
- Tests de bout en bout : `npm run test:e2e` dans `frontend/` (pile à eux : base `timesheet_api_e2e` recréée, API port 5100, interface port 5174 ; la base de développement n'est jamais touchée).
- Image de production : `docker build -f deploy/Dockerfile -t timesheet .` ; premier admin plateforme : `--admin-plateforme adresse "Prénom" "Nom"` (`docs/exploitation.md`).
- Comptes de démonstration : mot de passe `SEED_PASSWORD` (`appsettings.Development.json`) ; aicha.ndongo, samuel.etoga, brigitte.mbarga, paul.tchouta, rose.ekambi @exemple.com.

## Repères

- API : `backend/TimeSheet.Api/src/TimeSheet.Api/`. Routes dans `Controllers/v1/` ; règles pures dans `Domain/<Domaine>/*Rules.cs` (testées par `tests/…UnitTests`) ; gestionnaires MediatR dans `Domain/<Domaine>/Features/` ; utilisateur connecté et portée par `IViewerAccessor` (`Services/Access/`). Erreur de règle : `RuleException(code, champs)` → 422 ; hors portée → 404.
- Horloge : `TimeProvider` de l'application (`Services/AppClock.cs`), jamais `DateTime.Now` pour une règle métier. `TIMESHEET_NOW` (démonstration) part du jeudi 19 mars 2026, semaine 12. Fenêtres de sécurité en heure réelle (`AuditEntry.RecordedAt`).
- Saisie en jours entiers (point 82) : une journée par jour, sur un seul projet ; `FrenchFormat.Days`.
- E-mails : gabarits dans `Services/Mail/MailTemplates.cs` (Mailpit en développement) ; préférences de notification de l'utilisateur (écran 14) respectées avant chaque envoi.
- PDF : gabarits HTML imprimés par Chromium (`Services/Export/`), pour les exports du reporting et du journal d'audit. `STORAGE_DIR` ne garde plus que les clés des sessions.
- Seeds : `Databases/Seed/` (`DemoSeed`, `E2eSeed` pour les divisions de test `*.e2e@exemple.com`, `PlatformAdmin`). CX Expertise n'est jamais modifiée par les tests.
- Interface : `frontend/src/`, Feature-Sliced Design (`app` > `pages` > `widgets` > `features` > `entities` > `shared`). Composants ODS dans `shared/ui/`, textes dans `shared/i18n/fr.ts`, formats dans `shared/lib/format.ts`, statuts dans `shared/lib/status.ts` et `<StatusBadge>`. Thème Tailwind : `app/styles/index.css` ; contrôle : `scripts/check-styles.mjs`.
- Données de l'interface : requêtes et écritures TanStack Query dans `entities/<domaine>/api/` ; règles d'affichage pures dans `entities/<domaine>/lib/` (testées par Vitest).
- Production : `deploy/Dockerfile` (l'API sert l'interface), staging `deploy/staging/` et `docs/staging.md`, exploitation `docs/exploitation.md`, architecture `docs/architecture.md`.
