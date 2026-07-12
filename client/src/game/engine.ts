/** @format */

import * as THREE from 'three';
import type { NetworkClient } from './network';
import type { InteractionManager } from './interactions';

interface EngineOptions {
	joyBase?: HTMLElement | null;
	joyStick?: HTMLElement | null;
}

interface JoystickState {
	active: boolean;
	baseX: number;
	baseY: number;
	stickX: number;
	stickY: number;
	maxDistance: number;
	moveThreshold: number;
}

// moteur three.js, vue iso ortho
// la boucle de rendu reste ici, pas de r3f (cf page archi notion)
export class GameEngine {
	container: HTMLElement;
	width: number;
	height: number;

	renderer!: THREE.WebGLRenderer;
	scene!: THREE.Scene;
	camera!: THREE.OrthographicCamera;
	player!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
	highlight!: THREE.Mesh;

	network: NetworkClient | null = null;
	interactions: InteractionManager | null = null;

	moveStep = 12;
	targetPos: THREE.Vector3 | null = null;
	moveLerp = 0.15;
	joystick!: JoystickState;

	private joyBaseEl: HTMLElement | null;
	private joyStickEl: HTMLElement | null;
	private rafId: number | null = null;
	private disposed = false;
	private cleanups: Array<() => void> = [];

	constructor(
		container: HTMLElement,
		{ joyBase, joyStick }: EngineOptions = {}
	) {
		this.container = container;
		this.width = container.clientWidth;
		this.height = container.clientHeight;
		this.joyBaseEl = joyBase || null;
		this.joyStickEl = joyStick || null;

		this.init();
		this.bindEvents();
		this.animate();
	}

	private init() {
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setSize(this.width, this.height);
		this.renderer.setPixelRatio(window.devicePixelRatio || 1);
		this.container.appendChild(this.renderer.domElement);

		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x20232a);

		const aspect = this.width / this.height;
		const d = 100;
		this.camera = new THREE.OrthographicCamera(
			-d * aspect,
			d * aspect,
			d,
			-d,
			0.1,
			1000
		);
		this.camera.position.set(200, 200, 200);
		this.camera.lookAt(0, 0, 0);

		this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
		const directional = new THREE.DirectionalLight(0xffffff, 0.6);
		directional.position.set(100, 200, 100);
		this.scene.add(directional);

		const grid = new THREE.GridHelper(200, 20, 0x444444, 0x2a2a2a);
		grid.rotation.x = Math.PI / 2;
		this.scene.add(grid);

		const geometry = new THREE.BoxGeometry(10, 10, 10);
		const material = new THREE.MeshStandardMaterial({ color: 0x66ccff });
		this.player = new THREE.Mesh(geometry, material);
		this.player.position.set(0, 5, 0);
		this.scene.add(this.player);

		// surbrillance de la case courante
		const planeGeom = new THREE.PlaneGeometry(12, 12);
		const planeMat = new THREE.MeshBasicMaterial({
			color: 0xffff66,
			opacity: 0.4,
			transparent: true,
			side: THREE.DoubleSide,
		});
		this.highlight = new THREE.Mesh(planeGeom, planeMat);
		this.highlight.rotation.x = -Math.PI / 2;
		this.highlight.position.set(0, 0.05, 0);
		this.scene.add(this.highlight);

		this.joystick = {
			active: false,
			baseX: 0,
			baseY: 0,
			stickX: 0,
			stickY: 0,
			maxDistance: 35,
			moveThreshold: 10,
		};

		const onResize = () => {
			this.width = this.container.clientWidth;
			this.height = this.container.clientHeight;
			const a = this.width / this.height;
			this.camera.left = -d * a;
			this.camera.right = d * a;
			this.camera.top = d;
			this.camera.bottom = -d;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(this.width, this.height);
		};
		window.addEventListener('resize', onResize);
		this.cleanups.push(() =>
			window.removeEventListener('resize', onResize)
		);
	}

	private bindEvents() {
		const onKeyDown = (e: KeyboardEvent) => {
			// pas de deplacement quand on tape dans un input
			const tag = document.activeElement?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;

			const key = e.key.toLowerCase();
			let dx = 0,
				dz = 0;

			if (key === 'arrowup' || key === 'w') dz = -this.moveStep;
			if (key === 'arrowdown' || key === 's') dz = this.moveStep;
			if (key === 'arrowleft' || key === 'a') dx = -this.moveStep;
			if (key === 'arrowright' || key === 'd') dx = this.moveStep;

			if (dx !== 0 || dz !== 0) this.movePlayer(dx, dz);
		};
		window.addEventListener('keydown', onKeyDown);
		this.cleanups.push(() =>
			window.removeEventListener('keydown', onKeyDown)
		);

		this.initJoystick();
	}

	private initJoystick() {
		const joyBase = this.joyBaseEl;
		const joyStick = this.joyStickEl;
		if (!joyBase || !joyStick) return;

		let moveInterval: ReturnType<typeof setInterval> | null = null;

		const handleStart = (e: Event) => {
			e.preventDefault();
			this.joystick.active = true;

			const rect = joyBase.getBoundingClientRect();
			this.joystick.baseX = rect.left + rect.width / 2;
			this.joystick.baseY = rect.top + rect.height / 2;

			if (moveInterval) clearInterval(moveInterval);
			moveInterval = setInterval(
				() => this.updatePlayerFromJoystick(),
				150
			);
		};

		const handleMove = (e: MouseEvent | TouchEvent) => {
			if (!this.joystick.active) return;
			e.preventDefault();

			const touch = 'touches' in e ? e.touches[0] : e;
			let deltaX = touch.clientX - this.joystick.baseX;
			let deltaY = touch.clientY - this.joystick.baseY;

			const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			if (distance > this.joystick.maxDistance) {
				const angle = Math.atan2(deltaY, deltaX);
				deltaX = Math.cos(angle) * this.joystick.maxDistance;
				deltaY = Math.sin(angle) * this.joystick.maxDistance;
			}

			this.joystick.stickX = deltaX;
			this.joystick.stickY = deltaY;
			joyStick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
		};

		const handleEnd = (e: Event) => {
			e.preventDefault();
			this.joystick.active = false;
			this.joystick.stickX = 0;
			this.joystick.stickY = 0;
			joyStick.style.transform = 'translate(-50%, -50%)';

			if (moveInterval) {
				clearInterval(moveInterval);
				moveInterval = null;
			}
		};

		joyBase.addEventListener('touchstart', handleStart, { passive: false });
		joyBase.addEventListener('touchmove', handleMove, { passive: false });
		joyBase.addEventListener('touchend', handleEnd, { passive: false });
		joyBase.addEventListener('mousedown', handleStart);
		document.addEventListener('mousemove', handleMove);
		document.addEventListener('mouseup', handleEnd);

		this.cleanups.push(() => {
			if (moveInterval) clearInterval(moveInterval);
			joyBase.removeEventListener('touchstart', handleStart);
			joyBase.removeEventListener('touchmove', handleMove);
			joyBase.removeEventListener('touchend', handleEnd);
			joyBase.removeEventListener('mousedown', handleStart);
			document.removeEventListener('mousemove', handleMove);
			document.removeEventListener('mouseup', handleEnd);
		});
	}

	private updatePlayerFromJoystick() {
		if (!this.joystick.active) return;

		const threshold = this.joystick.moveThreshold;
		if (
			Math.abs(this.joystick.stickX) <= threshold &&
			Math.abs(this.joystick.stickY) <= threshold
		) {
			return;
		}

		let dx = 0,
			dz = 0;
		const angle = Math.atan2(this.joystick.stickY, this.joystick.stickX);
		const degrees = angle * (180 / Math.PI);

		// 8 directions
		if (degrees >= -22.5 && degrees < 22.5) dx = this.moveStep;
		else if (degrees >= 22.5 && degrees < 67.5) {
			dx = this.moveStep;
			dz = this.moveStep;
		} else if (degrees >= 67.5 && degrees < 112.5) dz = this.moveStep;
		else if (degrees >= 112.5 && degrees < 157.5) {
			dx = -this.moveStep;
			dz = this.moveStep;
		} else if (degrees >= 157.5 || degrees < -157.5) dx = -this.moveStep;
		else if (degrees >= -157.5 && degrees < -112.5) {
			dx = -this.moveStep;
			dz = -this.moveStep;
		} else if (degrees >= -112.5 && degrees < -67.5) dz = -this.moveStep;
		else if (degrees >= -67.5 && degrees < -22.5) {
			dx = this.moveStep;
			dz = -this.moveStep;
		}

		if (dx !== 0 || dz !== 0) this.movePlayer(dx, dz);
	}

	movePlayer(dx: number, dz: number) {
		const newX = Math.round(this.player.position.x) + dx;
		const newZ = Math.round(this.player.position.z) + dz;
		this.targetPos = new THREE.Vector3(newX, this.player.position.y, newZ);
	}

	animate() {
		if (this.disposed) return;
		this.rafId = requestAnimationFrame(() => this.animate());

		if (this.targetPos) {
			this.player.position.lerp(this.targetPos, this.moveLerp);

			if (this.player.position.distanceToSquared(this.targetPos) < 0.01) {
				this.player.position.copy(this.targetPos);
				if (this.network) {
					this.network.sendPlayerPosition(
						this.player.position.x,
						this.player.position.y,
						this.player.position.z
					);
				}
				this.targetPos = null;
			}

			this.highlight.position.x = Math.round(this.player.position.x);
			this.highlight.position.z = Math.round(this.player.position.z);
		}

		if (this.network) this.network.update();
		if (this.interactions) this.interactions.update();

		this.renderer.render(this.scene, this.camera);
	}

	destroy() {
		this.disposed = true;
		if (this.rafId) cancelAnimationFrame(this.rafId);
		this.cleanups.forEach((fn) => fn());
		this.cleanups = [];

		this.scene.traverse((obj) => {
			const mesh = obj as THREE.Mesh;
			if (mesh.geometry) mesh.geometry.dispose();
			if (mesh.material) {
				const mats = Array.isArray(mesh.material)
					? mesh.material
					: [mesh.material];
				mats.forEach((m) => {
					const map = (m as THREE.MeshBasicMaterial).map;
					if (map) map.dispose();
					m.dispose();
				});
			}
		});

		this.renderer.dispose();
		this.renderer.domElement.parentNode?.removeChild(
			this.renderer.domElement
		);
	}
}
