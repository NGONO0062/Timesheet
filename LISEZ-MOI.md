# Dossier de passation TimeSheet

## Par où commencer

1. `README.md` : ce que fait l'application, comment la lancer en local, les comptes de démonstration.
2. `PROMPT.md` : la spécification complète (produit, design system, données, règles métier, écrans, tests). Elle décrit le produit ; la technique a changé depuis (voir le point 4).
3. `design/` : feuille de style, planches en HTML et captures de référence. Voir `design/README.md`. Règles visuelles revues : `docs/design-v2.md`.
4. `docs/reecriture.md` : pourquoi et comment l'application a été réécrite sur la stack Orange (.NET et React), jalon par jalon, avec les écarts assumés. La première version (Next.js, Prisma) n'est plus dans le dépôt ; elle reste lisible dans l'historique Git (commit 5833734).
5. `docs/exploitation.md` et `docs/staging.md` : mise en production et environnement d'essai.

## Travailler avec Claude Code

- `CLAUDE.md` contient les règles que Claude Code relit à chaque session (couleurs, graisses, espacements, sécurité, méthode, commandes).
- Méthode : un changement à la fois ; tests, comparaison avec `design/captures/`, commit, résumé, puis accord.

## Points encore ouverts

- `docs/questions-ouvertes.md` : choix faits pendant le développement et points à confirmer (ce document cite encore des fichiers de la première version : les règles restent valables, les chemins sont ceux de l'historique).
- `docs/exploitation.md`, section « Avant la mise en production » : ce qui reste à faire par l'exploitation, dont la première construction de l'image.
