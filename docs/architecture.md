# Architecture

## Pile

Next.js 16 (App Router, composants serveur, actions serveur), React 19, TypeScript strict, Prisma 6 et PostgreSQL, Auth.js (identifiants, sessions JWT), Boosted 5.3 (ODS) pour les styles, Nodemailer pour les e-mails, playwright-core (Chromium) pour les PDF. Tests : Vitest (unitaires et intégration), Playwright et axe-core (bout en bout, accessibilité). Ni Tailwind, ni bibliothèque de composants, ni bibliothèque de graphiques.

## Couches

| Dossier | Contenu | Règle |
|---|---|---|
| `app/` | Routes, pages (composants serveur), écrans interactifs (`*Screen.tsx`, composants client), états `loading.tsx` et `error.tsx`. | Une page lit ses données par `lib/data/`, jamais Prisma directement. |
| `app/actions/` | Actions serveur : validation zod des entrées, puis appel de la couche de données. | Chaque action relit l'utilisateur connecté et ses permissions. |
| `lib/data/` | Seule couche qui importe Prisma (règle ESLint). Chaque fonction reçoit une portée (`DivisionScope`, `PlatformScope`, ou le seul compte connecté) et revérifie la permission. | Aucune donnée ne traverse d'une division à l'autre. |
| `lib/` (hors `data/`) | Règles métier pures : semaines ISO, saisie, statuts, validation, fiche de présence, reporting, administration, onboarding, journal. | Testées par Vitest, sans base. |
| `components/ods/` | Composants ODS (Boosted) : Button, Form, Display, Navigation, Overlay, Dropdown, TableScroll. | Tels quels ; écarts notés dans `docs/ecarts-ods.md`. |
| `components/ts/` | Composants propres à TimeSheet (`.ts-*`) : sélecteur de semaine, grille de saisie, zone de signature, visionneuse de la fiche, étiquettes de statut, champs de configuration de division. | Un seul composant de statut : `<StatusBadge>`. |
| `lib/i18n/fr.ts` | Tous les textes d'interface, repris des maquettes. | Pas de texte en dur dans les écrans. |
| `lib/format.ts` | Nombres (virgule), espaces insécables, dates et heures dans le fuseau de Douala. | |
| `styles/timesheet.css` | Section 0 : neutralisation de Boosted ; 1 : reprise de `design/ods.css` ; 2 : application. | Contrôlée par `npm run lint:styles`. |

## Contrôles d'accès

1. `proxy.ts` : sans cookie de session, retour à la connexion (contrôle optimiste).
2. `getViewer()` relit l'utilisateur en base à chaque requête : un compte désactivé ou une division suspendue n'a plus d'accès, même avec une session valide.
3. Les permissions effectives (matrice par défaut du §7, puis réglages de la division) pilotent la navigation et chaque contrôle serveur.
4. Une page réservée renvoie un vrai 404 : le contrôle est fait dans un `layout.tsx` du segment quand la page a un état de chargement.

## Horloges

- Règles métier : `now()` de `lib/clock.ts`. `TIMESHEET_NOW` fixe le point de départ en démonstration, puis le temps avance.
- Journal d'audit : `at` suit `now()` (affichage, filtres) ; `recordedAt` est l'heure réelle d'enregistrement (fenêtres de limitation, qui ne doivent pas reculer au redémarrage).

## E-mails et tâches

- Gabarits purs dans `lib/mail/templates.ts` (texte brut et HTML sobre, sans image), envoi par `lib/mail/send.ts`. Préférences de notification dans `lib/notifications.ts`.
- Tâches planifiées protégées par `TASKS_SECRET` : `app/api/taches/relances` (validateurs) et `app/api/taches/rappels-saisie` (vendredi 12:00). Voir `docs/exploitation.md`.

## Données de démonstration et de test

- `prisma/seed.ts` : division CX Expertise et données des maquettes (semaine 12 de 2026), division en onboarding et journal d'audit de la planche 13. Idempotent sur une base existante.
- `prisma/e2e-fixtures.ts` : divisions de test des tests de bout en bout, remises à zéro avant chaque exécution. CX Expertise n'est jamais modifiée par les tests.
- Tests d'intégration (`lib/data/__tests__`) : divisions fixes (« integration-… »), réutilisées d'une exécution à l'autre (le journal, en ajout seul, empêche de supprimer une division qu'il référence).
