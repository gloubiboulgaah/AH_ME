/** @format */

import type * as THREE from 'three';
import type { AvatarBuild } from './voxel/models/avatar';

export interface PlayerData {
	id: string;
	userId: number | null;
	username: string;
	x: number;
	y: number;
	z: number;
	color: number;
	// apparence choisie a la personnalisation, absente = avatar par defaut
	skin?: string | null;
	build?: AvatarBuild | null;
	connected: number;
}

export interface ChatMessage {
	playerId: string;
	username: string;
	message: string;
	timestamp: number;
}

export interface PrivateMessage {
	from: string;
	fromUsername: string;
	message: string;
	timestamp: number;
}

// mesh joueur avec interpolation et label
// la geometrie vient du registre voxel, elle est partagee donc jamais liberee ici
export type PlayerMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material> & {
	// absent tant que le joueur n'a pas recu de position a rejoindre
	targetPos?: THREE.Vector3 | null;
	userData: {
		playerId?: string;
		username?: string;
		label?: THREE.Sprite;
	};
};

export interface DeskSummary {
	deskId: number;
	slotIndex: number;
	userId: number | null;
	username: string | null;
	content: { files: number; notes: number };
}
