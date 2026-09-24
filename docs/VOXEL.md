<!-- @format -->

# Modèles voxel

Le moteur vit dans `client/src/game/voxel/`. Aujourd'hui tous les modèles sont des **bouchons générés en code** (`voxel/models/`). Ce document explique comment les remplacer par de vrais fichiers.

## Formats acceptés

Deux formats, choisis automatiquement selon l'extension :

- **`.vox`** — export MagicaVoxel. Les chunks `SIZE`, `XYZI` et `RGBA` sont lus. La conversion z-up → y-up est faite par le loader, rien à préparer.
- **`.json`** — format maison, pratique pour du généré ou du fait main :

```json
{
	"name": "avatar",
	"size": [8, 16, 6],
	"palette": ["#d99b6c", "#66ccff", "#2f3b52"],
	"voxels": [
		[2, 0, 2, 2],
		[3, 0, 2, 2]
	]
}
```

`voxels` contient des quadruplets `[x, y, z, indexPalette]`, l'index commençant à 0.

## Conventions à respecter

| Règle | Détail |
| --- | --- |
| Orientation | le modèle regarde vers **+z**, la rotation suit le sens du déplacement |
| Origine | `y = 0` est le sol, le modèle est centré automatiquement en x/z |
| Échelle | 1 voxel = 1 unité monde, une case de déplacement en fait **12** |
| Avatar | viser ~8 × 16 × 6 voxels pour rester à l'échelle des bureaux |
| Bureau | le plateau du bureau bouchon est à `y = 9`, les objets posés dessus s'alignent sur cette valeur |

## Brancher un fichier

Les fichiers vont dans `client/public/models/`. Dans `engine.ts`, `registerModels()` déclare aujourd'hui les bouchons :

```ts
this.registry.register('desk', buildDeskModel());
```

Pour passer à un fichier, on remplace par un chargement :

```ts
await this.registry.loadInto('desk', '/models/desk.vox');
```

Les clés utilisées par le reste du code sont `avatar`, `desk`, `chair`, `screen` et `plant`. Tant qu'une clé garde son nom, aucun autre fichier n'est à toucher : le registre construit la géométrie à la demande et la met en cache, et tous les mesh partagent la même instance.

## Ce que fait le mesher

`mesher.ts` transforme une grille de voxels en `BufferGeometry` :

- les faces collées à un voisin plein ne sont pas générées, ce qui divise le nombre de triangles d'un ordre de grandeur sur un modèle plein
- les couleurs de la palette sont portées par les sommets, donc **un seul material** pour toute la scène
- un paramètre `scale` permet une grille grossière pour la map (6 unités par voxel) et fine pour les objets

Le greedy meshing (fusion des faces coplanaires) n'est pas fait : inutile à cette taille de modèles.
