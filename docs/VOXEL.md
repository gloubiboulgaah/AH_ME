<!-- @format -->

# Modèles voxel

Le moteur vit dans `client/src/game/voxel/`. Les modèles sont **décrits en code** dans `voxel/models/` : c'est le choix retenu, pas un bouchon. Ça évite un outil de modélisation à maîtriser, et l'avatar doit de toute façon être généré à la volée (peau, silhouette, couleur du tee-shirt).

## Modèles existants

| Clé | Fichier | Taille (x × y × z) | Remarque |
| --- | --- | --- | --- |
| `avatar` | `avatar.ts` | 8 × 17 × 6 | paramétré : `skin`, `shirt`, `pants`, `shoes`, `hair`, `build` (`slim` / `standard` / `large`) |
| `desk` | `furniture.ts` | 16 × 9 × 10 | plateau à `y = 9`, caisson à tiroirs côté +z |
| `chair` | `furniture.ts` | 8 × 13 × 8 | chaise à roulettes avec accoudoirs |
| `screen` | `furniture.ts` | 10 × 9 × 3 | posé sur le plateau |
| `plant` | `furniture.ts` | 9 × 18 × 9 | coins du salon |
| `bookshelf` | `furniture.ts` | 12 × 22 × 5 | mur ouest |
| `coffee` | `furniture.ts` | 12 × 18 × 7 | comptoir + machine, mur est |
| `cooler` | `furniture.ts` | 6 × 22 × 6 | fontaine à eau, mur est |
| `armchair` | `furniture.ts` | 11 × 10 × 10 | coin détente |
| `lamp` | `furniture.ts` | 7 × 24 × 7 | lampadaire |
| `rug` | `furniture.ts` | 34 × 1 × 22 | ne bloque pas le passage |

La pile de documents et les post-its posés sur un bureau sont générés à la demande par `desks.ts` (`buildPaperStackModel`, `buildStickyNoteModel`).

## Ajouter ou modifier un modèle

1. Écrire une fonction `buildXxxModel()` dans `voxel/models/` : `createModel(nom, taille, palette)` puis des `fillBox(model, de, à, indexPalette)` (bornes incluses) ou `setVoxel` pour un voxel isolé.
2. L'enregistrer dans `registerModels()` (`engine.ts`).
3. Pour un meuble de décor, l'ajouter au type `DecorationModel` et le placer avec `decorate()` dans `salon/layout.ts` (case, rotation, décalage vers le mur, bloquant ou non).

En dev, `window.engine` donne accès au moteur depuis la console : `engine.camera.zoom = 4; engine.camera.updateProjectionMatrix()` pour regarder un modèle de près.

## Remplacer un modèle par un fichier

Rien n'empêche de passer un modèle sur un fichier si quelqu'un en dessine un un jour.

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
| Bureau | le plateau du bureau est à `y = 9`, les objets posés dessus s'alignent sur cette valeur |

## Brancher un fichier

Les fichiers vont dans `client/public/models/`. Dans `engine.ts`, `registerModels()` déclare les modèles en code :

```ts
this.registry.register('desk', buildDeskModel());
```

Pour passer à un fichier, on remplace par un chargement :

```ts
await this.registry.loadInto('desk', '/models/desk.vox');
```

Tant qu'une clé garde son nom, aucun autre fichier n'est à toucher : le registre construit la géométrie à la demande et la met en cache, et tous les mesh partagent la même instance.

## Ce que fait le mesher

`mesher.ts` transforme une grille de voxels en `BufferGeometry` :

- les coins de chaque face tournent dans le sens anti-horaire vus de l'extérieur : sinon three.js la prend pour une face arrière, la masque et affiche celle d'en face, non éclairée (les côtés sortaient noirs avant la correction)
- les faces collées à un voisin plein ne sont pas générées, ce qui divise le nombre de triangles d'un ordre de grandeur sur un modèle plein
- les couleurs de la palette sont portées par les sommets, donc **un seul material** pour toute la scène
- un paramètre `scale` permet une grille grossière pour la map (6 unités par voxel) et fine pour les objets

Le greedy meshing (fusion des faces coplanaires) n'est pas fait : inutile à cette taille de modèles.
