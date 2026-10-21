/** @format */

import type * as THREE from 'three';

// l'avatar est un seul mesh, on anime l'ensemble plutot que les membres :
// petits sauts en marchant, respiration a l'arret
const STEP_SPEED = 14;
const STEP_HEIGHT = 1.2;
const BREATH_SPEED = 2.2;
const BREATH_AMPLITUDE = 0.02;

export function animateAvatar(
	mesh: THREE.Object3D,
	moving: boolean,
	time: number
) {
	// dephasage par mesh pour que tout le monde ne respire pas en rythme
	const phase = mesh.id * 1.7;

	if (moving) {
		mesh.position.y = Math.abs(Math.sin(time * STEP_SPEED)) * STEP_HEIGHT;
		mesh.scale.y = 1;
		return;
	}

	mesh.position.y = 0;
	mesh.scale.y = 1 + Math.sin(time * BREATH_SPEED + phase) * BREATH_AMPLITUDE;
}
