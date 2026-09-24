/** @format */

import * as THREE from 'three';
import { buildGeometry, createVoxelMaterial } from './mesher';
import { loadVoxelModel } from './loaders';
import { VOXEL_SIZE, type VoxelModel } from './types';

// un seul material pour tous les modeles, les couleurs sont dans les sommets
let sharedMaterial: THREE.MeshLambertMaterial | null = null;

export function voxelMaterial(): THREE.MeshLambertMaterial {
	if (!sharedMaterial) sharedMaterial = createVoxelMaterial();
	return sharedMaterial;
}

interface Entry {
	model: VoxelModel;
	scale: number;
	geometry: THREE.BufferGeometry | null;
}

// quand les vrais fichiers arrivent, il suffit de les charger ici avec
// loadInto() et les bouchons sont remplaces sans toucher au reste du code
export class VoxelRegistry {
	private entries = new Map<string, Entry>();

	register(key: string, model: VoxelModel, scale = VOXEL_SIZE) {
		const previous = this.entries.get(key);
		previous?.geometry?.dispose();

		this.entries.set(key, { model, scale, geometry: null });
	}

	// remplace un modele par un fichier .json ou .vox
	async loadInto(key: string, url: string, scale = VOXEL_SIZE) {
		const model = await loadVoxelModel(url);
		this.register(key, model, scale);
		return model;
	}

	has(key: string) {
		return this.entries.has(key);
	}

	model(key: string): VoxelModel {
		const entry = this.entries.get(key);
		if (!entry) throw new Error(`modele voxel inconnu: ${key}`);
		return entry.model;
	}

	// la geometrie est construite une fois puis reutilisee par tous les mesh
	geometry(key: string): THREE.BufferGeometry {
		const entry = this.entries.get(key);
		if (!entry) throw new Error(`modele voxel inconnu: ${key}`);

		if (!entry.geometry) {
			entry.geometry = buildGeometry(entry.model, entry.scale);
		}

		return entry.geometry;
	}

	mesh(key: string): THREE.Mesh {
		const mesh = new THREE.Mesh(this.geometry(key), voxelMaterial());
		mesh.name = key;
		return mesh;
	}

	dispose() {
		this.entries.forEach((entry) => entry.geometry?.dispose());
		this.entries.clear();
	}
}
