/** @format */

import { createModel, fillBox } from '../model';
import type { VoxelModel } from '../types';

export type AvatarBuild = 'narrow' | 'standard' | 'wide';

export interface AvatarOptions {
	skin?: string;
	shirt?: string;
	pants?: string;
	shoes?: string;
	hair?: string;
	build?: AvatarBuild;
}

const SKIN = 0;
const SHIRT = 1;
const PANTS = 2;
const SHOES = 3;
const EYES = 4;
const HAIR = 5;

// le modele regarde vers +z, la rotation suit le sens du deplacement
const BUILDS: Record<
	AvatarBuild,
	{ torsoX: [number, number]; torsoZ: [number, number] }
> = {
	narrow: { torsoX: [2, 5], torsoZ: [2, 3] },
	standard: { torsoX: [2, 5], torsoZ: [1, 4] },
	wide: { torsoX: [1, 6], torsoZ: [1, 4] },
};

// modele bouchon en attendant les vrais fichiers voxel
export function buildAvatarModel(options: AvatarOptions = {}): VoxelModel {
	const {
		skin = '#d99b6c',
		shirt = '#66ccff',
		pants = '#2f3b52',
		shoes = '#1b2030',
		hair = '#3a2a1d',
		build = 'standard',
	} = options;

	const model = createModel(
		'avatar',
		[8, 16, 6],
		[skin, shirt, pants, shoes, '#1a1a22', hair]
	);

	const { torsoX, torsoZ } = BUILDS[build];

	// jambes
	fillBox(model, [2, 0, 2], [3, 0, 3], SHOES);
	fillBox(model, [4, 0, 2], [5, 0, 3], SHOES);
	fillBox(model, [2, 1, 2], [3, 5, 3], PANTS);
	fillBox(model, [4, 1, 2], [5, 5, 3], PANTS);

	// torse
	fillBox(
		model,
		[torsoX[0], 6, torsoZ[0]],
		[torsoX[1], 11, torsoZ[1]],
		SHIRT
	);

	// bras le long du corps
	fillBox(model, [torsoX[0] - 1, 6, 2], [torsoX[0] - 1, 10, 3], SHIRT);
	fillBox(model, [torsoX[1] + 1, 6, 2], [torsoX[1] + 1, 10, 3], SHIRT);
	fillBox(model, [torsoX[0] - 1, 9, 2], [torsoX[0] - 1, 10, 3], SKIN);
	fillBox(model, [torsoX[1] + 1, 9, 2], [torsoX[1] + 1, 10, 3], SKIN);

	// tete
	fillBox(model, [2, 12, 1], [5, 14, 4], SKIN);
	fillBox(model, [2, 15, 1], [5, 15, 4], HAIR);

	// yeux sur la face avant
	fillBox(model, [2, 13, 4], [2, 13, 4], EYES);
	fillBox(model, [5, 13, 4], [5, 13, 4], EYES);

	return model;
}
