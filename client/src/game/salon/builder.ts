/** @format */

import * as THREE from 'three';
import { createModel, fillBox } from '../voxel/model';
import { buildGeometry } from '../voxel/mesher';
import { voxelMaterial, type VoxelRegistry } from '../voxel/registry';
import {
	MAP_VOXEL,
	SALON_LAYOUT,
	TILE,
	WALL_TILES_HIGH,
	type SalonLayout,
} from './layout';

const FLOOR_A = 0;
const FLOOR_B = 1;
const WALL = 2;
const WALL_TOP = 3;
const BASEBOARD = 4;

// sol et murs en un seul modele voxel grossier, 2 voxels par case
function buildShellModel(layout: SalonLayout) {
	const sx = layout.tilesX * 2;
	const sz = layout.tilesZ * 2;
	const wallHigh = WALL_TILES_HIGH * 2;

	// +1 en y pour le sol, place sous le niveau 0
	const model = createModel(
		'salon-shell',
		[sx, wallHigh + 1, sz],
		['#3c4250', '#343a46', '#525a6b', '#626b7e', '#2b303a']
	);

	// damier au sol
	for (let x = 0; x < sx; x += 1) {
		for (let z = 0; z < sz; z += 1) {
			const even = (Math.floor(x / 2) + Math.floor(z / 2)) % 2 === 0;
			fillBox(model, [x, 0, z], [x, 0, z], even ? FLOOR_A : FLOOR_B);
		}
	}

	// murs sur le perimetre
	for (let y = 1; y <= wallHigh; y += 1) {
		const color = y === wallHigh ? WALL_TOP : WALL;

		fillBox(model, [0, y, 0], [sx - 1, y, 0], color);
		fillBox(model, [0, y, sz - 1], [sx - 1, y, sz - 1], color);
		fillBox(model, [0, y, 0], [0, y, sz - 1], color);
		fillBox(model, [sx - 1, y, 0], [sx - 1, y, sz - 1], color);
	}

	// plinthe plus sombre au pied des murs
	fillBox(model, [0, 1, 0], [sx - 1, 1, 0], BASEBOARD);
	fillBox(model, [0, 1, sz - 1], [sx - 1, 1, sz - 1], BASEBOARD);
	fillBox(model, [0, 1, 0], [0, 1, sz - 1], BASEBOARD);
	fillBox(model, [sx - 1, 1, 0], [sx - 1, 1, sz - 1], BASEBOARD);

	return model;
}

export interface SalonBuild {
	group: THREE.Group;
	deskAnchors: THREE.Object3D[];
	dispose: () => void;
}

// construit le decor et retourne un ancrage par emplacement de bureau
export function buildSalon(
	scene: THREE.Scene,
	registry: VoxelRegistry
): SalonBuild {
	const layout = SALON_LAYOUT;
	const group = new THREE.Group();
	group.name = 'salon';

	const shellGeometry = buildGeometry(buildShellModel(layout), MAP_VOXEL);
	const shell = new THREE.Mesh(shellGeometry, voxelMaterial());

	// le sol occupe le niveau 0 du modele, on descend pour que sa face
	// superieure tombe sur y = 0
	shell.position.y = -MAP_VOXEL;
	shell.name = 'salon-shell';
	group.add(shell);

	const deskAnchors: THREE.Object3D[] = [];

	layout.deskSlots.forEach((slot) => {
		const anchor = new THREE.Group();
		anchor.position.set(slot.x, 0, slot.z);
		anchor.rotation.y = slot.rotation;
		anchor.name = `desk-slot-${slot.index}`;
		anchor.userData.slotIndex = slot.index;

		const desk = registry.mesh('desk');
		anchor.add(desk);

		const chair = registry.mesh('chair');
		// la chaise se place devant le bureau, cote interieur de la piece
		chair.position.set(0, 0, TILE * 0.75);
		chair.rotation.y = Math.PI;
		anchor.add(chair);

		const screen = registry.mesh('screen');
		screen.position.set(-3, 9, -1);
		anchor.add(screen);

		group.add(anchor);
		deskAnchors.push(anchor);
	});

	layout.decorations.forEach((decoration) => {
		const mesh = registry.mesh(decoration.model);
		mesh.position.set(decoration.x, 0, decoration.z);
		group.add(mesh);
	});

	scene.add(group);

	return {
		group,
		deskAnchors,
		dispose: () => {
			scene.remove(group);
			shellGeometry.dispose();
		},
	};
}
