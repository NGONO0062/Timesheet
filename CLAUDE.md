# TimeSheet

Application interne Orange Cameroun : projets, temps de travail, fiche de présence RH. Spécification complète dans `PROMPT.md`. Maquettes dans `design/`.

## Règles à ne jamais enfreindre

- Couleurs : uniquement `#ff7900`, `#f16e00`, `#000000`, `#ffffff`, `#999999`, `#595959`, `#dddddd`, `#fafafa`, `#228722`, `#cd3c14`, `#ffd200`, `#4170d8`.
- Graphiques seulement : quatre couleurs de séries, dans cet ordre, `#237eca`, `#198c51`, `#6e4aa7`, `#d573bb`. Jamais ailleurs.
- `#ff7900` sert à l'état actif seulement. Le primaire est `#f16e00`.
- Graisses 400 et 700. Jamais 500 ni 600.
- Espacements : 0, 5, 10, 20, 30, 60 px.
- Bordures de 2 px, jamais 1 px. Rayon 6 px, 8 au maximum.
- Aucune ombre, aucun dégradé, aucune opacité réduite (seul le voile de modale est à 50 %).
- Survol par inversion de contraste. Désactivé opaque.
- Jamais d'information portée par la couleur seule. Liens soulignés.
- Composants ODS (Boosted) tels quels. Composants spécifiques préfixés `.ts-`.
- Statuts : uniquement les libellés de la planche `C4-Etiquettes-statut`, via un composant unique. Une seule étiquette par objet.
- Un seul bouton primaire par écran. Action réversible : pas de confirmation, un message avec « Annuler ».
- Pas de logo. Le mot « TimeSheet », « Time » en `#f16e00`, « Sheet » en blanc sur fond noir.
- Pas de Tailwind, pas de bibliothèque de composants tierce, pas de bibliothèque de graphiques.
- Chaque requête passe par la couche d'accès aux données, avec `divisionId`. Aucune donnée ne traverse d'une division à l'autre.
- Interface en français. Libellés repris des maquettes mot pour mot.
- Aucune donnée réelle ni secret dans le dépôt.

## Méthode

- Un jalon à la fois (voir `PROMPT.md`, §21). Tests, comparaison avec `design/captures/`, commit, résumé, puis attendre l'accord.
- Une question ouverte se note dans `docs/questions-ouvertes.md`. Un écart avec Boosted se note dans `docs/ecarts-ods.md`.

## Commandes

- Installation : `npm install`, puis `npx prisma generate` et `npx playwright install chromium`. Copier `.env.example` en `.env`.
- Services de développement : `docker compose up -d` (PostgreSQL sur 5432, Mailpit sur 1025 / interface 8025).
- Développement : `npm run dev`, puis http://localhost:3000/design pour les composants.
- Contrôles : `npm run check` (TypeScript, ESLint, contrôle de style, tests unitaires).
- Tests unitaires : `npm test`. Tests de bout en bout et axe-core : `npm run test:e2e`.
- Contrôle de style seul (§4.2) : `npm run lint:styles`.
- Base : `npm run db:migrate`, `npm run db:seed`. Repartir de zéro : `npm run db:reset` (le journal d'audit refuse les suppressions, la base est recréée).
- Tests d'intégration (base du seed) : `npm run test:int`.
- Comptes de démonstration : mot de passe `SEED_PASSWORD` de `.env` ; aicha.ndongo, samuel.etoga, brigitte.mbarga, paul.tchouta, rose.ekambi @exemple.com. `DEMO_PROFILES="true"` affiche les profils sur l'écran de connexion.

## Repères

- Styles : Boosted (`boosted.css`) puis `styles/timesheet.css`. Section 0 = neutralisation de Boosted, section 1 = reprise de `design/ods.css`, section 2 = application.
- Composants ODS : `components/ods/`. Composants spécifiques : `components/ts/`. Statuts : `<StatusBadge>` et `lib/status.ts` uniquement.
- Règles métier pures dans `lib/` (testées par Vitest). Prisma seulement dans `lib/data/` (règle ESLint).
- Textes d'interface dans `lib/i18n/fr.ts`. Formats (virgule, espace insécable, dates) dans `lib/format.ts`.
- Prisma 6 tant que Node < 22.12 (voir `docs/questions-ouvertes.md`).
- Authentification : `auth.ts` (Auth.js, JWT). Utilisateur connecté : `getViewer()` / `requirePermission()` dans `lib/data/viewer.ts`. Navigation : `lib/navigation.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
