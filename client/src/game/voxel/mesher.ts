/** @format */

import * as THREE from 'three';
import { getVoxel } from './model';
import { VOXEL_SIZE, type VoxelModel } from './types';

interface Face {
	offset: [number, number, number];
	normal: [number, number, number];
	corners: Array<[number, number, number]>;
}

// coins dans le sens anti-horaire vus de l'exterieur, sinon three.js
// prend la face pour une face arriere et la masque
const FACES: Face[] = [
	{
		offset: [1, 0, 0],
		normal: [1, 0, 0],
		corners: [
			[1, 0, 0],
			[1, 1, 0],
			[1, 1, 1],
			[1, 0, 1],
		],
	},
	{
		offset: [-1, 0, 0],
		normal: [-1, 0, 0],
		corners: [
			[0, 0, 1],
			[0, 1, 1],
			[0, 1, 0],
			[0, 0, 0],
		],
	},
	{
		offset: [0, 1, 0],
		normal: [0, 1, 0],
		corners: [
			[0, 1, 1],
			[1, 1, 1],
			[1, 1, 0],
			[0, 1, 0],
		],
	},
	{
		offset: [0, -1, 0],
		normal: [0, -1, 0],
		corners: [
			[0, 0, 0],
			[1, 0, 0],
			[1, 0, 1],
			[0, 0, 1],
		],
	},
	{
		offset: [0, 0, 1],
		normal: [0, 0, 1],
		corners: [
			[1, 0, 1],
			[1, 1, 1],
			[0, 1, 1],
			[0, 0, 1],
		],
	},
	{
		offset: [0, 0, -1],
		normal: [0, 0, -1],
		corners: [
			[0, 0, 0],
			[0, 1, 0],
			[1, 1, 0],
			[1, 0, 0],
		],
	},
];

const colorCache = new Map<string, THREE.Color>();

function paletteColor(hex: string): THREE.Color {
	let color = colorCache.get(hex);

	if (!color) {
		color = new THREE.Color(hex);
		color.convertSRGBToLinear();
		colorCache.set(hex, color);
	}

	return color;
}

// les faces collees a un voisin plein ne sont pas generees, c'est ce qui
// fait tomber le nombre de triangles sur un modele plein
// couleurs portees par les sommets, donc un seul material par modele
// le modele est centre en x/z et pose sur y = 0
// scale permet une grille grossiere pour la map et fine pour les objets
export function buildGeometry(
	model: VoxelModel,
	scale = VOXEL_SIZE
): THREE.BufferGeometry {
	const [sx, sy, sz] = model.size;

	const positions: number[] = [];
	const normals: number[] = [];
	const colors: number[] = [];
	const indices: number[] = [];

	const offsetX = (sx / 2) * scale;
	const offsetZ = (sz / 2) * scale;

	for (let z = 0; z < sz; z += 1) {
		for (let y = 0; y < sy; y += 1) {
			for (let x = 0; x < sx; x += 1) {
				const value = getVoxel(model, x, y, z);
				if (value === 0) continue;

				const hex = model.palette[value - 1] ?? '#ff00ff';
				const color = paletteColor(hex);

				FACES.forEach((face) => {
					const [ox, oy, oz] = face.offset;

					// voisin plein, face cachee
					if (getVoxel(model, x + ox, y + oy, z + oz) !== 0) {
						return;
					}

					const base = positions.length / 3;

					face.corners.forEach(([cx, cy, cz]) => {
						positions.push(
							(x + cx) * scale - offsetX,
							(y + cy) * scale,
							(z + cz) * scale - offsetZ
						);
						normals.push(...face.normal);
						colors.push(color.r, color.g, color.b);
					});

					indices.push(
						base,
						base + 1,
						base + 2,
						base,
						base + 2,
						base + 3
					);
				});
			}
		}
	}

	const geometry = new THREE.BufferGeometry();

	geometry.setAttribute(
		'position',
		new THREE.Float32BufferAttribute(positions, 3)
	);
	geometry.setAttribute(
		'normal',
		new THREE.Float32BufferAttribute(normals, 3)
	);
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	geometry.setIndex(indices);
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();

	return geometry;
}

export function createVoxelMaterial(): THREE.MeshLambertMaterial {
	return new THREE.MeshLambertMaterial({ vertexColors: true });
}

export function triangleCount(geometry: THREE.BufferGeometry): number {
	const index = geometry.getIndex();
	return index ? index.count / 3 : 0;
}
