/** @format */

// un voxel = 1 unite monde, une case de deplacement en fait 12
export const VOXEL_SIZE = 1;

export type VoxelColor = string;

// grille de voxels, data indexe en x + y * sx + z * sx * sy
// 0 = vide, n = index palette + 1
export interface VoxelModel {
	name: string;
	size: [number, number, number];
	palette: VoxelColor[];
	data: Uint8Array;
}

// format d'echange, ecrit a la main ou exporte depuis un outil
export interface VoxelModelJson {
	name?: string;
	size: [number, number, number];
	palette: VoxelColor[];
	// [x, y, z, paletteIndex], paletteIndex commence a 0
	voxels: Array<[number, number, number, number]>;
}
