/** @format */

import { createModel, fillBox } from '../model';
import type { VoxelModel } from '../types';

// memes noms que la silhouette choisie dans l'ecran de personnalisation
export type AvatarBuild = 'slim' | 'standard' | 'large';

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
const SOLE = 6;
const MOUTH = 7;
const BELT = 8;

// le modele regarde vers +z, la rotation suit le sens du deplacement
// z = 5 est la face avant
const BUILDS: Record<
	AvatarBuild,
	{ torsoX: [number, number]; torsoZ: [number, number] }
> = {
	slim: { torsoX: [2, 5], torsoZ: [2, 3] },
	standard: { torsoX: [2, 5], torsoZ: [1, 4] },
	large: { torsoX: [1, 6], torsoZ: [1, 4] },
};

export function buildAvatarModel(options: AvatarOptions = {}): VoxelModel {
	const {
		skin = '#d99b6c',
		shirt = '#66ccff',
		pants = '#2f3b52',
		shoes = '#3a2b22',
		hair = '#3a2a1d',
		build = 'standard',
	} = options;

	const model = createModel(
		'avatar',
		[8, 17, 6],
		[
			skin,
			shirt,
			pants,
			shoes,
			'#1a1a22',
			hair,
			'#e8e2d6',
			'#8a4b3a',
			'#1f2533',
		]
	);

	const { torsoX, torsoZ } = BUILDS[build];
	const [left, right] = torsoX;

	// chaussures, la pointe depasse vers l'avant
	fillBox(model, [2, 0, 2], [3, 0, 4], SOLE);
	fillBox(model, [4, 0, 2], [5, 0, 4], SOLE);
	fillBox(model, [2, 1, 2], [3, 1, 4], SHOES);
	fillBox(model, [4, 1, 2], [5, 1, 4], SHOES);

	// jambes
	fillBox(model, [2, 2, 2], [3, 5, 3], PANTS);
	fillBox(model, [4, 2, 2], [5, 5, 3], PANTS);

	// torse, la ceinture ferme le bas du tee-shirt
	fillBox(model, [left, 6, torsoZ[0]], [right, 10, torsoZ[1]], SHIRT);
	fillBox(model, [left, 6, torsoZ[0]], [right, 6, torsoZ[1]], BELT);

	// col en v sur la face avant
	fillBox(model, [3, 10, torsoZ[1]], [4, 10, torsoZ[1]], SKIN);

	// bras le long du corps, mains en bas
	fillBox(model, [left - 1, 7, 2], [left - 1, 10, 3], SHIRT);
	fillBox(model, [right + 1, 7, 2], [right + 1, 10, 3], SHIRT);
	fillBox(model, [left - 1, 6, 2], [left - 1, 6, 3], SKIN);
	fillBox(model, [right + 1, 6, 2], [right + 1, 6, 3], SKIN);

	// cou
	fillBox(model, [3, 11, 2], [4, 11, 3], SKIN);

	// tete un peu plus large que le corps, style habbo
	fillBox(model, [1, 12, 1], [6, 15, 5], SKIN);

	// cheveux : dessus, arriere et tempes, frange sur le front
	fillBox(model, [1, 16, 1], [6, 16, 5], HAIR);
	fillBox(model, [1, 12, 0], [6, 16, 0], HAIR);
	fillBox(model, [1, 13, 1], [6, 16, 1], HAIR);
	fillBox(model, [1, 14, 1], [1, 15, 3], HAIR);
	fillBox(model, [6, 14, 1], [6, 15, 3], HAIR);
	fillBox(model, [1, 15, 5], [6, 15, 5], HAIR);
	fillBox(model, [4, 14, 5], [5, 14, 5], HAIR);

	// visage
	fillBox(model, [2, 13, 5], [2, 13, 5], EYES);
	fillBox(model, [5, 13, 5], [5, 13, 5], EYES);
	fillBox(model, [3, 12, 5], [4, 12, 5], MOUTH);

	return model;
}
