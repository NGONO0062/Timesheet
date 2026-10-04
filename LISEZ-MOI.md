# Dossier de passation TimeSheet

## Comment s'en servir

1. Crée un dossier vide pour le projet et copie dedans tout le contenu de ce dossier : `PROMPT.md`, `CLAUDE.md` et `design/`.
2. Ouvre Claude Code dans ce dossier.
3. Envoie ce message :

   > Lis PROMPT.md en entier, puis design/README.md. Dis-moi ce que tu as compris et les points de la stack qui te posent un problème, puis lance le jalon 0.

4. À la fin de chaque jalon, Claude Code s'arrête et attend. Compare ses écrans aux images de `design/captures/`, puis réponds « jalon suivant » ou dis ce qu'il faut corriger.

## Contenu

- `PROMPT.md` : la spécification complète (produit, design system, données, règles métier, écrans, tests, jalons).
- `CLAUDE.md` : les règles que Claude Code relit à chaque session.
- `design/` : feuille de style, 29 planches en HTML, 29 captures, sources du prototype. Voir `design/README.md`.

## Avant de lancer

Relis le §20 de `PROMPT.md` (points ouverts). Chaque ligne a une valeur par défaut. Si l'une d'elles est fausse, corrige-la dans le fichier avant de commencer : c'est moins cher que de la corriger dans le code.
