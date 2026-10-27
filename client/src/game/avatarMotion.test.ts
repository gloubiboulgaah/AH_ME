
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { animateAvatar } from './avatarMotion';

describe('Animation des avatars 3D', () => {
	it('positionne un avatar immobile au sol', () => {
		const mesh = new THREE.Group();
		mesh.position.y = 5;

		animateAvatar(mesh, false, 0);

		expect(mesh.position.y).toBe(0);
	});

	it('applique une respiration à un avatar immobile', () => {
		const mesh = new THREE.Group();

		animateAvatar(mesh, false, 1);

		expect(mesh.scale.y).toBeGreaterThanOrEqual(0.98);
		expect(mesh.scale.y).toBeLessThanOrEqual(1.02);
	});

	it('anime les pas quand le joueur se déplace', () => {
		const mesh = new THREE.Group();

		animateAvatar(mesh, true, Math.PI / 28);

		expect(mesh.position.y).toBeCloseTo(1.2);
		expect(mesh.scale.y).toBe(1);
	});

	it('réinitialise la hauteur à l’arrêt', () => {
		const mesh = new THREE.Group();

		animateAvatar(mesh, true, Math.PI / 28);
		expect(mesh.position.y).toBeGreaterThan(0);

		animateAvatar(mesh, false, 0);

		expect(mesh.position.y).toBe(0);
	});

	it('réinitialise la respiration pendant le déplacement', () => {
		const mesh = new THREE.Group();

		animateAvatar(mesh, false, 1);
		animateAvatar(mesh, true, 2);

		expect(mesh.scale.y).toBe(1);
	});
});
