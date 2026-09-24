/** @format */

import { createModel, fillBox } from '../model';
import type { VoxelModel } from '../types';

// modeles bouchons en attendant les vrais fichiers voxel

// le bureau regarde vers +z, la chaise se place derriere
export function buildDeskModel(): VoxelModel {
	const WOOD = 0;
	const WOOD_DARK = 1;
	const METAL = 2;

	const model = createModel(
		'desk',
		[16, 9, 10],
		['#a9743f', '#7d5329', '#4a5060']
	);

	// plateau
	fillBox(model, [0, 7, 0], [15, 8, 9], WOOD);
	// liseres plus sombres pour marquer les bords
	fillBox(model, [0, 7, 0], [15, 7, 0], WOOD_DARK);
	fillBox(model, [0, 7, 9], [15, 7, 9], WOOD_DARK);

	// pieds
	fillBox(model, [1, 0, 1], [2, 6, 2], METAL);
	fillBox(model, [13, 0, 1], [14, 6, 2], METAL);
	fillBox(model, [1, 0, 7], [2, 6, 8], METAL);
	fillBox(model, [13, 0, 7], [14, 6, 8], METAL);

	// caisson sur le cote
	fillBox(model, [11, 1, 2], [14, 6, 8], WOOD_DARK);

	return model;
}

export function buildChairModel(): VoxelModel {
	const SEAT = 0;
	const FRAME = 1;

	const model = createModel('chair', [8, 12, 8], ['#3b4256', '#22262f']);

	// assise
	fillBox(model, [0, 5, 0], [7, 6, 7], SEAT);
	// dossier
	fillBox(model, [0, 7, 0], [7, 11, 1], SEAT);
	// pied central et socle
	fillBox(model, [3, 1, 3], [4, 4, 4], FRAME);
	fillBox(model, [1, 0, 3], [6, 0, 4], FRAME);
	fillBox(model, [3, 0, 1], [4, 0, 6], FRAME);

	return model;
}

export function buildScreenModel(): VoxelModel {
	const CASE = 0;
	const SCREEN = 1;

	const model = createModel('screen', [8, 8, 3], ['#2a2e38', '#5fa8d3']);

	// dalle
	fillBox(model, [0, 2, 1], [7, 7, 2], CASE);
	fillBox(model, [1, 3, 2], [6, 6, 2], SCREEN);
	// pied
	fillBox(model, [3, 0, 1], [4, 1, 1], CASE);
	fillBox(model, [2, 0, 0], [5, 0, 2], CASE);

	return model;
}

export function buildPlantModel(): VoxelModel {
	const POT = 0;
	const SOIL = 1;
	const LEAF = 2;
	const LEAF_DARK = 3;

	const model = createModel(
		'plant',
		[7, 14, 7],
		['#a8552f', '#4a3325', '#4c9a52', '#35713a']
	);

	// pot
	fillBox(model, [1, 0, 1], [5, 3, 5], POT);
	fillBox(model, [2, 4, 2], [4, 4, 4], SOIL);

	// tige et feuillage
	fillBox(model, [3, 5, 3], [3, 9, 3], LEAF_DARK);
	fillBox(model, [1, 8, 2], [5, 11, 4], LEAF);
	fillBox(model, [2, 8, 1], [4, 11, 5], LEAF);
	fillBox(model, [2, 12, 2], [4, 13, 4], LEAF_DARK);

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

// post-it colle sur le plateau
export function buildStickyNoteModel(color: string): VoxelModel {
	const NOTE = 0;
	const LINE = 1;

	const model = createModel('sticky-note', [4, 1, 4], [color, '#00000022']);

	fillBox(model, [0, 0, 0], [3, 0, 3], NOTE);
	fillBox(model, [1, 0, 1], [2, 0, 1], LINE);

	return model;
}
