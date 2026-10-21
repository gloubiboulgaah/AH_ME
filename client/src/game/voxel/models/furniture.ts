/** @format */

import { createModel, fillBox, setVoxel } from '../model';
import type { VoxelModel } from '../types';

// tous les modeles regardent vers +z, la face avant est donc la plus grande z

// la chaise se place devant, cote +z, le plateau finit a y = 9
export function buildDeskModel(): VoxelModel {
	const WOOD = 0;
	const WOOD_DARK = 1;
	const METAL = 2;
	const HANDLE = 3;
	const DRAWER = 4;

	const model = createModel(
		'desk',
		[16, 9, 10],
		['#b07a45', '#7d5329', '#4a5060', '#c9ccd4', '#8f6136']
	);

	// plateau avec un chant plus sombre tout autour
	fillBox(model, [0, 7, 0], [15, 8, 9], WOOD);
	fillBox(model, [0, 7, 0], [15, 7, 9], WOOD_DARK);
	fillBox(model, [1, 7, 1], [14, 7, 8], WOOD);

	// pieds en metal, traverse arriere pour le style
	fillBox(model, [1, 0, 1], [1, 6, 1], METAL);
	fillBox(model, [1, 0, 8], [1, 6, 8], METAL);
	fillBox(model, [1, 5, 1], [1, 5, 8], METAL);
	fillBox(model, [1, 0, 1], [1, 0, 8], METAL);
	fillBox(model, [1, 5, 1], [10, 5, 1], METAL);

	// caisson a trois tiroirs cote droit
	fillBox(model, [10, 0, 1], [14, 6, 8], WOOD_DARK);
	fillBox(model, [10, 0, 8], [14, 6, 8], DRAWER);
	fillBox(model, [10, 2, 8], [14, 2, 8], WOOD_DARK);
	fillBox(model, [10, 4, 8], [14, 4, 8], WOOD_DARK);
	fillBox(model, [12, 1, 9], [12, 1, 9], HANDLE);
	fillBox(model, [12, 3, 9], [12, 3, 9], HANDLE);
	fillBox(model, [12, 5, 9], [12, 5, 9], HANDLE);

	return model;
}

// chaise de bureau a roulettes
export function buildChairModel(): VoxelModel {
	const SEAT = 0;
	const SEAT_DARK = 1;
	const FRAME = 2;
	const WHEEL = 3;

	const model = createModel(
		'chair',
		[8, 13, 8],
		['#3e5c8a', '#2c4366', '#2a2e38', '#111318']
	);

	// pietement en etoile, roulettes au bout des branches
	fillBox(model, [1, 1, 3], [6, 1, 4], FRAME);
	fillBox(model, [3, 1, 1], [4, 1, 6], FRAME);
	fillBox(model, [1, 0, 3], [1, 0, 4], WHEEL);
	fillBox(model, [6, 0, 3], [6, 0, 4], WHEEL);
	fillBox(model, [3, 0, 1], [4, 0, 1], WHEEL);
	fillBox(model, [3, 0, 6], [4, 0, 6], WHEEL);

	// verin
	fillBox(model, [3, 2, 3], [4, 4, 4], FRAME);

	// assise rembourree, plus sombre sur le pourtour
	fillBox(model, [1, 5, 1], [6, 5, 7], SEAT_DARK);
	fillBox(model, [1, 6, 1], [6, 6, 7], SEAT);

	// dossier legerement cintre
	fillBox(model, [1, 7, 0], [6, 12, 0], SEAT_DARK);
	fillBox(model, [2, 7, 1], [5, 11, 1], SEAT);
	fillBox(model, [2, 12, 0], [5, 12, 0], SEAT);

	// accoudoirs
	fillBox(model, [0, 6, 3], [0, 8, 3], FRAME);
	fillBox(model, [7, 6, 3], [7, 8, 3], FRAME);
	fillBox(model, [0, 9, 2], [0, 9, 5], FRAME);
	fillBox(model, [7, 9, 2], [7, 9, 5], FRAME);

	return model;
}

// ecran pose sur le bureau
export function buildScreenModel(): VoxelModel {
	const CASE = 0;
	const SCREEN = 1;
	const SCREEN_LIGHT = 2;
	const WINDOW = 3;
	const LED = 4;

	const model = createModel(
		'screen',
		[10, 9, 3],
		['#22252d', '#2f6d9a', '#4b97c9', '#e6edf3', '#5be37d']
	);

	// pied
	fillBox(model, [3, 0, 0], [6, 0, 2], CASE);
	fillBox(model, [4, 1, 0], [5, 2, 0], CASE);

	// dalle et bordure
	fillBox(model, [0, 2, 0], [9, 8, 1], CASE);
	fillBox(model, [1, 3, 1], [8, 7, 1], SCREEN);

	// degrade du fond d'ecran et une fenetre ouverte
	fillBox(model, [1, 6, 1], [8, 7, 1], SCREEN_LIGHT);
	fillBox(model, [2, 4, 1], [5, 6, 1], WINDOW);

	// voyant d'alimentation
	setVoxel(model, 8, 2, 1, LED);

	return model;
}

// plante en pot, feuillage irregulier pour casser l'effet cube
export function buildPlantModel(): VoxelModel {
	const POT = 0;
	const POT_RIM = 1;
	const SOIL = 2;
	const LEAF = 3;
	const LEAF_DARK = 4;
	const LEAF_LIGHT = 5;

	const model = createModel(
		'plant',
		[9, 18, 9],
		['#b5603a', '#8c4528', '#4a3325', '#4c9a52', '#35713a', '#78c26c']
	);

	// pot evase avec un rebord
	fillBox(model, [3, 0, 3], [5, 0, 5], POT);
	fillBox(model, [2, 1, 2], [6, 4, 6], POT);
	fillBox(model, [2, 5, 2], [6, 5, 6], POT_RIM);
	fillBox(model, [3, 5, 3], [5, 5, 5], SOIL);

	// tige
	fillBox(model, [4, 6, 4], [4, 9, 4], LEAF_DARK);

	// feuillage en couches, chaque couche decalee de la precedente
	fillBox(model, [1, 9, 2], [7, 11, 6], LEAF);
	fillBox(model, [2, 9, 1], [6, 11, 7], LEAF);
	fillBox(model, [0, 10, 3], [8, 10, 5], LEAF_DARK);
	fillBox(model, [3, 10, 0], [5, 10, 8], LEAF_DARK);
	fillBox(model, [2, 12, 2], [6, 14, 6], LEAF);
	fillBox(model, [3, 15, 3], [5, 16, 5], LEAF_LIGHT);
	setVoxel(model, 4, 17, 4, LEAF_LIGHT);

	// quelques feuilles claires qui accrochent la lumiere
	[
		[1, 11, 3],
		[6, 11, 1],
		[7, 11, 5],
		[2, 14, 5],
		[5, 14, 2],
		[3, 13, 6],
	].forEach(([x, y, z]) => setVoxel(model, x, y, z, LEAF_LIGHT));

	return model;
}

// bibliotheque adossee au mur, ouverte vers +z
export function buildBookshelfModel(): VoxelModel {
	const WOOD = 0;
	const WOOD_DARK = 1;
	const BOOKS = [2, 3, 4, 5, 6, 7];

	const model = createModel(
		'bookshelf',
		[12, 22, 5],
		[
			'#8f6136',
			'#5e3d1f',
			'#c0392b',
			'#2e86c1',
			'#27ae60',
			'#f1c40f',
			'#8e44ad',
			'#ecf0f1',
		]
	);

	// fond, montants et etageres
	fillBox(model, [0, 0, 0], [11, 21, 0], WOOD_DARK);
	fillBox(model, [0, 0, 0], [0, 21, 4], WOOD);
	fillBox(model, [11, 0, 0], [11, 21, 4], WOOD);
	[0, 7, 14, 21].forEach((y) => fillBox(model, [0, y, 0], [11, y, 4], WOOD));

	// livres de hauteurs variables, motif fixe pour rester deterministe
	const heights = [5, 4, 6, 5, 3, 6, 4, 5, 6, 4];
	[1, 8, 15].forEach((base, shelf) => {
		for (let i = 0; i < 10; i += 1) {
			// une place vide par etagere, sinon ca fait un mur de livres
			if (i === (shelf * 3 + 2) % 10) continue;

			const height = heights[(i + shelf * 4) % heights.length];
			const color = BOOKS[(i + shelf * 2) % BOOKS.length];
			fillBox(model, [i + 1, base, 1], [i + 1, base + height, 3], color);
		}
	});

	return model;
}

// comptoir avec machine a cafe et tasses
export function buildCoffeeModel(): VoxelModel {
	const COUNTER = 0;
	const COUNTER_TOP = 1;
	const MACHINE = 2;
	const MACHINE_LIGHT = 3;
	const CUP = 4;
	const COFFEE = 5;
	const LED = 6;

	const model = createModel(
		'coffee',
		[12, 18, 7],
		[
			'#d9d4c7',
			'#3b3f4a',
			'#2a2c33',
			'#b8bcc6',
			'#f4f4f4',
			'#5a3720',
			'#ff5a4e',
		]
	);

	// meuble bas
	fillBox(model, [0, 0, 0], [11, 8, 5], COUNTER);
	fillBox(model, [0, 0, 5], [11, 0, 5], COUNTER_TOP);
	fillBox(model, [5, 1, 6], [6, 7, 6], COUNTER);
	fillBox(model, [0, 9, 0], [11, 9, 6], COUNTER_TOP);

	// machine
	fillBox(model, [1, 10, 0], [6, 17, 4], MACHINE);
	fillBox(model, [2, 11, 4], [5, 13, 4], MACHINE_LIGHT);
	fillBox(model, [3, 15, 5], [4, 15, 5], MACHINE);
	setVoxel(model, 5, 16, 5, LED);

	// tasse sous le bec et une autre a cote
	fillBox(model, [3, 10, 4], [4, 11, 5], CUP);
	setVoxel(model, 3, 11, 5, COFFEE);
	fillBox(model, [8, 10, 3], [9, 11, 4], CUP);
	setVoxel(model, 8, 11, 4, COFFEE);

	return model;
}

// fontaine a eau
export function buildCoolerModel(): VoxelModel {
	const BODY = 0;
	const BODY_DARK = 1;
	const WATER = 2;
	const WATER_LIGHT = 3;
	const TAP = 4;

	const model = createModel(
		'cooler',
		[6, 22, 6],
		['#e8e8ec', '#b7bac2', '#5aa9e6', '#9fd3f5', '#d64541']
	);

	fillBox(model, [0, 0, 0], [5, 0, 5], BODY_DARK);
	fillBox(model, [1, 1, 1], [4, 12, 4], BODY);
	fillBox(model, [1, 5, 4], [4, 5, 4], BODY_DARK);

	// robinets
	setVoxel(model, 2, 9, 5, TAP);
	setVoxel(model, 3, 9, 5, WATER);

	// bonbonne retournee
	fillBox(model, [1, 13, 1], [4, 19, 4], WATER);
	fillBox(model, [1, 14, 4], [1, 18, 4], WATER_LIGHT);
	fillBox(model, [2, 20, 2], [3, 21, 3], WATER);

	return model;
}

// fauteuil pour le coin detente
export function buildArmchairModel(): VoxelModel {
	const FABRIC = 0;
	const FABRIC_DARK = 1;
	const LEG = 2;

	const model = createModel(
		'armchair',
		[11, 10, 10],
		['#d4874e', '#a8653a', '#3a2b22']
	);

	// pieds
	fillBox(model, [0, 0, 0], [0, 0, 0], LEG);
	fillBox(model, [10, 0, 0], [10, 0, 0], LEG);
	fillBox(model, [0, 0, 9], [0, 0, 9], LEG);
	fillBox(model, [10, 0, 9], [10, 0, 9], LEG);

	// base, coussin et dossier
	fillBox(model, [0, 1, 0], [10, 3, 9], FABRIC_DARK);
	fillBox(model, [2, 4, 2], [8, 4, 9], FABRIC);
	fillBox(model, [0, 4, 0], [10, 9, 2], FABRIC_DARK);
	fillBox(model, [2, 5, 2], [8, 8, 2], FABRIC);

	// accoudoirs
	fillBox(model, [0, 4, 3], [1, 6, 9], FABRIC_DARK);
	fillBox(model, [9, 4, 3], [10, 6, 9], FABRIC_DARK);
	fillBox(model, [0, 6, 3], [1, 6, 9], FABRIC);
	fillBox(model, [9, 6, 3], [10, 6, 9], FABRIC);

	return model;
}

// lampadaire
export function buildLampModel(): VoxelModel {
	const BASE = 0;
	const SHADE = 1;
	const SHADE_LIGHT = 2;

	const model = createModel(
		'lamp',
		[7, 24, 7],
		['#2a2c33', '#f3e2b3', '#fff6d8']
	);

	fillBox(model, [2, 0, 2], [4, 0, 4], BASE);
	fillBox(model, [3, 1, 3], [3, 17, 3], BASE);
	fillBox(model, [1, 18, 1], [5, 22, 5], SHADE);
	fillBox(model, [0, 18, 2], [6, 20, 4], SHADE);
	fillBox(model, [2, 18, 0], [4, 20, 6], SHADE);
	fillBox(model, [2, 23, 2], [4, 23, 4], SHADE_LIGHT);

	return model;
}

// tapis du coin detente, ne bloque pas le passage
export function buildRugModel(): VoxelModel {
	const BASE = 0;
	const BORDER = 1;
	const MOTIF = 2;

	const width = 34;
	const depth = 22;

	const model = createModel(
		'rug',
		[width, 1, depth],
		['#6b8fb5', '#2f4a6b', '#e3d4a8']
	);

	fillBox(model, [0, 0, 0], [width - 1, 0, depth - 1], BORDER);
	fillBox(model, [2, 0, 2], [width - 3, 0, depth - 3], BASE);

	// losanges au centre
	const cx = (width - 1) / 2;
	const cz = (depth - 1) / 2;

	for (let x = 2; x < width - 2; x += 1) {
		for (let z = 2; z < depth - 2; z += 1) {
			const d = Math.abs(x - cx) / 2 + Math.abs(z - cz);
			if (Math.round(d) % 4 === 0) setVoxel(model, x, 0, z, MOTIF);
		}
	}

	return model;
}

// pile de feuilles posee sur le bureau, la hauteur suit le nombre de docs
export function buildPaperStackModel(sheets: number): VoxelModel {
	const PAPER = 0;
	const PAPER_EDGE = 1;

	const height = Math.max(1, Math.min(sheets, 10));
	const model = createModel(
		'paper-stack',
		[6, height, 8],
		['#f3efe4', '#cfc8b6']
	);

	for (let y = 0; y < height; y += 1) {
		fillBox(model, [0, y, 0], [5, y, 7], y % 2 === 0 ? PAPER : PAPER_EDGE);
	}

	return model;
}

// meme teinte en plus sombre, la palette n'accepte pas la transparence
function darken(hex: string, factor: number): string {
	const value = parseInt(hex.slice(1, 7), 16);
	const channel = (shift: number) =>
		Math.round(((value >> shift) & 0xff) * factor)
			.toString(16)
			.padStart(2, '0');

	return `#${channel(16)}${channel(8)}${channel(0)}`;
}

// post-it colle sur le plateau
export function buildStickyNoteModel(color: string): VoxelModel {
	const NOTE = 0;
	const LINE = 1;

	const model = createModel(
		'sticky-note',
		[4, 1, 4],
		[color, darken(color, 0.75)]
	);

	fillBox(model, [0, 0, 0], [3, 0, 3], NOTE);
	fillBox(model, [1, 0, 1], [2, 0, 1], LINE);

	return model;
}
