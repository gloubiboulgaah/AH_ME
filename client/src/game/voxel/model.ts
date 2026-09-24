/** @format */

import type { VoxelColor, VoxelModel, VoxelModelJson } from './types';

export function createModel(
	name: string,
	size: [number, number, number],
	palette: VoxelColor[]
): VoxelModel {
	const [sx, sy, sz] = size;

	return {
		name,
		size,
		palette,
		data: new Uint8Array(sx * sy * sz),
	};
}

function index(model: VoxelModel, x: number, y: number, z: number): number {
	const [sx, sy] = model.size;
	return x + y * sx + z * sx * sy;
}

export function inBounds(
	model: VoxelModel,
	x: number,
	y: number,
	z: number
): boolean {
	const [sx, sy, sz] = model.size;
	return x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz;
}

// 0 si vide ou hors limites
export function getVoxel(
	model: VoxelModel,
	x: number,
	y: number,
	z: number
): number {
	if (!inBounds(model, x, y, z)) return 0;
	return model.data[index(model, x, y, z)];
}

export function setVoxel(
	model: VoxelModel,
	x: number,
	y: number,
	z: number,
	paletteIndex: number
) {
	if (!inBounds(model, x, y, z)) return;
	model.data[index(model, x, y, z)] = paletteIndex + 1;
}

// pave plein, bornes incluses
export function fillBox(
	model: VoxelModel,
	from: [number, number, number],
	to: [number, number, number],
	paletteIndex: number
) {
	for (let x = from[0]; x <= to[0]; x += 1) {
		for (let y = from[1]; y <= to[1]; y += 1) {
			for (let z = from[2]; z <= to[2]; z += 1) {
				setVoxel(model, x, y, z, paletteIndex);
			}
		}
	}
}

export function toJson(model: VoxelModel): VoxelModelJson {
	const [sx, sy, sz] = model.size;
	const voxels: VoxelModelJson['voxels'] = [];

	for (let z = 0; z < sz; z += 1) {
		for (let y = 0; y < sy; y += 1) {
			for (let x = 0; x < sx; x += 1) {
				const value = getVoxel(model, x, y, z);
				if (value > 0) voxels.push([x, y, z, value - 1]);
			}
		}
	}

	return {
		name: model.name,
		size: model.size,
		palette: model.palette,
		voxels,
	};
}

export function fromJson(json: VoxelModelJson, fallbackName = 'model') {
	const model = createModel(
		json.name ?? fallbackName,
		json.size,
		json.palette
	);

	json.voxels.forEach(([x, y, z, paletteIndex]) => {
		setVoxel(model, x, y, z, paletteIndex);
	});

	return model;
}
