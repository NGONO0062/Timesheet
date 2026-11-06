# TimeSheet : interface (React)

Frontend de la réécriture sur la stack Orange (voir `docs/reecriture.md`) : React 19, TypeScript strict, Vite, React Router 7, TanStack Query, Zustand, Tailwind 4, HeadlessUI. Organisation Feature-Sliced Design.

## Commandes (depuis `frontend/`)

- Installation : `npm install`.
- Développement : `npm run dev` (http://localhost:5173 ; `/api` est relayé vers l'API .NET sur http://localhost:5000, ou `TIMESHEET_API_URL`). Composants : http://localhost:5173/design.
- Contrôles : `npm run check` (TypeScript, ESLint avec les frontières des couches, contrôle de style, tests Vitest).
- Construction : `npm run build` (dossier `dist/`).

## Organisation (Feature-Sliced Design)

`src/app` (démarrage, fournisseurs, routes, thème) > `pages` > `widgets` > `features` > `entities` > `shared` (composants d'interface, utilitaires, accès à l'API). Une couche n'importe que les couches en dessous d'elle (règle ESLint).

## Règles visuelles

Le thème Tailwind (`src/app/styles/index.css`) ne contient que les valeurs des maquettes : 12 couleurs (plus 4 couleurs de séries pour les graphiques), espacements 0, 5, 10, 20, 30, 60 px, graisses 400 et 700, rayons 4, 6 et 8 px, aucune ombre ni flou. Les dimensions propres aux composants ODS portent un nom (`h-control`, `px-btn-x`…). `scripts/check-styles.mjs` refuse les valeurs arbitraires, les bordures autres que 2 px, les opacités (sauf le voile de modale `bg-black/50`), les dégradés, les couleurs en dur et les styles en ligne.
