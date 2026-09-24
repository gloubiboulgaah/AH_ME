/** @format */

import { createModel, setVoxel } from './model';
import { fromJson } from './model';
import type { VoxelModel, VoxelModelJson } from './types';

// palette par defaut de magicavoxel, utilisee si le fichier n'a pas de chunk RGBA
const DEFAULT_VOX_PALETTE_COLOR = '#cccccc';

interface VoxChunk {
	id: string;
	content: Uint8Array;
	childrenEnd: number;
	contentEnd: number;
}

function readChunk(view: DataView, offset: number): VoxChunk {
	const id = String.fromCharCode(
		view.getUint8(offset),
		view.getUint8(offset + 1),
		view.getUint8(offset + 2),
		view.getUint8(offset + 3)
	);

	const contentSize = view.getUint32(offset + 4, true);
	const childrenSize = view.getUint32(offset + 8, true);
	const contentStart = offset + 12;

	return {
		id,
		content: new Uint8Array(
			view.buffer,
			view.byteOffset + contentStart,
			contentSize
		),
		contentEnd: contentStart + contentSize,
		childrenEnd: contentStart + contentSize + childrenSize,
	};
}

// parse un .vox magicavoxel, on ne lit que SIZE, XYZI et RGBA
// magicavoxel est en z-up, on convertit en y-up pour three
export function parseVox(buffer: ArrayBuffer, name = 'model'): VoxelModel {
	const view = new DataView(buffer);

	const magic = String.fromCharCode(
		view.getUint8(0),
		view.getUint8(1),
		view.getUint8(2),
		view.getUint8(3)
	);

	if (magic !== 'VOX ') {
		throw new Error('fichier .vox invalide');
	}

	let size: [number, number, number] | null = null;
	let voxels: Array<[number, number, number, number]> = [];
	let palette: string[] | null = null;

	// on saute l'entete (magic + version) puis le chunk MAIN
	const main = readChunk(view, 8);
	let offset = main.contentEnd;

	while (offset < main.childrenEnd && offset < view.byteLength) {
		const chunk = readChunk(view, offset);
		const content = new DataView(
			chunk.content.buffer,
			chunk.content.byteOffset,
			chunk.content.byteLength
		);

		if (chunk.id === 'SIZE' && !size) {
			// x, y, z en z-up chez magicavoxel
			size = [
				content.getUint32(0, true),
				content.getUint32(8, true),
				content.getUint32(4, true),
			];
		}

		if (chunk.id === 'XYZI' && voxels.length === 0) {
			const count = content.getUint32(0, true);

			for (let i = 0; i < count; i += 1) {
				const base = 4 + i * 4;

				voxels.push([
					content.getUint8(base),
					content.getUint8(base + 2),
					content.getUint8(base + 1),
					content.getUint8(base + 3) - 1,
				]);
			}
		}

		if (chunk.id === 'RGBA') {
			palette = [];

			for (let i = 0; i < 256; i += 1) {
				const base = i * 4;
				const r = content.getUint8(base);
				const g = content.getUint8(base + 1);
				const b = content.getUint8(base + 2);

				palette.push(
					`#${[r, g, b]
						.map((channel) => channel.toString(16).padStart(2, '0'))
						.join('')}`
				);
			}
		}

		offset = chunk.childrenEnd;
	}

	if (!size) {
		throw new Error('chunk SIZE manquant dans le .vox');
	}

	const effectivePalette =
		palette ?? new Array(256).fill(DEFAULT_VOX_PALETTE_COLOR);

	const model = createModel(name, size, effectivePalette);

	voxels.forEach(([x, y, z, paletteIndex]) => {
		setVoxel(model, x, y, z, paletteIndex);
	});

	return model;
}

export async function loadVoxelJson(url: string): Promise<VoxelModel> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`modele introuvable: ${url}`);
	}

	const json = (await response.json()) as VoxelModelJson;
	return fromJson(json, url);
}

export async function loadVox(url: string): Promise<VoxelModel> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`modele introuvable: ${url}`);
	}

	return parseVox(await response.arrayBuffer(), url);
}

// choisit le loader selon l'extension
export function loadVoxelModel(url: string): Promise<VoxelModel> {
	return url.endsWith('.vox') ? loadVox(url) : loadVoxelJson(url);
}
