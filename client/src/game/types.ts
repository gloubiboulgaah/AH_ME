/** @format */

import type * as THREE from 'three';

export interface PlayerData {
	id: string;
	userId: number | null;
	username: string;
	x: number;
	y: number;
	z: number;
	color: number;
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
export type PlayerMesh = THREE.Mesh<
	THREE.BoxGeometry,
	THREE.MeshStandardMaterial
> & {
	targetPos: THREE.Vector3 | null;
	userData: {
		playerId?: string;
		username?: string;
		label?: THREE.Sprite;
	};
};
