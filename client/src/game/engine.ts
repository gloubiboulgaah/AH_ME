/** @format */

import * as THREE from 'three';
import type { NetworkClient } from './network';
import type { InteractionManager } from './interactions';
import type { PlayerData } from './types';
import { animateAvatar } from './avatarMotion';
import { VoxelRegistry, voxelMaterial } from './voxel/registry';
import { buildAvatarModel } from './voxel/models/avatar';
import {
	buildArmchairModel,
	buildBookshelfModel,
	buildChairModel,
	buildCoffeeModel,
	buildCoolerModel,
	buildDeskModel,
	buildLampModel,
	buildPlantModel,
	buildRugModel,
	buildScreenModel,
} from './voxel/models/furniture';
import { buildSalon, type SalonBuild } from './salon/builder';
import { DeskManager, type DeskInfo } from './salon/desks';
import { TILE, isWalkable, spawnPoint } from './salon/layout';

interface EngineOptions {
	joyBase?: HTMLElement | null;
	joyStick?: HTMLElement | null;
	// ouvre le panneau du bureau, rendu par l'ui react
	onOpenDesk?: (desk: DeskInfo) => void;
	onDeskTargetChange?: (desk: DeskInfo | null) => void;
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

// rayon d'interaction avec un bureau
// 1.6 pour couvrir la diagonale (TILE * racine de 2 = 17) sans atteindre
// la case suivante (24)
const DESK_REACH = TILE * 1.6;

// hauteur ou s'accroche une bulle de chat, juste au-dessus du pseudo
const BUBBLE_ANCHOR_Y = 24;

// moteur three.js, vue iso ortho
// la boucle de rendu reste ici, pas de r3f (cf page archi notion)
export class GameEngine {
	container: HTMLElement;
	width: number;
	height: number;

	renderer!: THREE.WebGLRenderer;
	scene!: THREE.Scene;
	camera!: THREE.OrthographicCamera;
	player!: THREE.Mesh;
	highlight!: THREE.Mesh;

	registry = new VoxelRegistry();
	salon!: SalonBuild;
	desks!: DeskManager;

	network: NetworkClient | null = null;
	interactions: InteractionManager | null = null;

	moveStep = TILE;
	targetPos: THREE.Vector3 | null = null;
	moveLerp = 0.15;
	joystick!: JoystickState;

	// bloque les entrees quand un panneau est ouvert par dessus le jeu
	inputLocked = false;

	private joyBaseEl: HTMLElement | null;
	private joyStickEl: HTMLElement | null;
	private onOpenDesk: (desk: DeskInfo) => void;
	private onDeskTargetChange: (desk: DeskInfo | null) => void;
	private targetedDesk: DeskInfo | null = null;
	private targetSignature = '';
	private cameraOffset = new THREE.Vector3(200, 200, 200);
	private clock = new THREE.Clock();
	private rafId: number | null = null;
	private disposed = false;
	private cleanups: Array<() => void> = [];

	constructor(container: HTMLElement, options: EngineOptions = {}) {
		this.container = container;
		this.width = container.clientWidth;
		this.height = container.clientHeight;
		this.joyBaseEl = options.joyBase || null;
		this.joyStickEl = options.joyStick || null;
		this.onOpenDesk = options.onOpenDesk ?? (() => {});
		this.onDeskTargetChange = options.onDeskTargetChange ?? (() => {});

		this.registerModels();
		this.init();
		this.bindEvents();
		this.animate();

		// acces au moteur depuis la console en dev
		if (import.meta.env.DEV) {
			(window as unknown as { engine: GameEngine }).engine = this;
		}
	}

	// les modeles sont decrits en code (cf docs/VOXEL.md), un fichier .vox
	// peut toujours en remplacer un avec registry.loadInto()
	private registerModels() {
		this.registry.register('avatar', buildAvatarModel());
		this.registry.register('desk', buildDeskModel());
		this.registry.register('chair', buildChairModel());
		this.registry.register('screen', buildScreenModel());
		this.registry.register('plant', buildPlantModel());
		this.registry.register('bookshelf', buildBookshelfModel());
		this.registry.register('coffee', buildCoffeeModel());
		this.registry.register('cooler', buildCoolerModel());
		this.registry.register('armchair', buildArmchairModel());
		this.registry.register('lamp', buildLampModel());
		this.registry.register('rug', buildRugModel());
	}

	// un avatar par combinaison couleur / peau / silhouette, mis en cache
	// on teinte le tee-shirt plutot que le material, sinon la peau bleuit
	avatarGeometryFor(
		player: Pick<PlayerData, 'color' | 'skin' | 'build'>
	): THREE.BufferGeometry {
		const { color, skin, build } = player;
		if (!color && !skin && !build) return this.registry.geometry('avatar');

		const shirt = color
			? `#${color.toString(16).padStart(6, '0')}`
			: undefined;
		const key = `avatar-${shirt ?? ''}-${skin ?? ''}-${build ?? ''}`;

		if (!this.registry.has(key)) {
			this.registry.register(
				key,
				buildAvatarModel({
					shirt,
					skin: skin ?? undefined,
					build: build ?? undefined,
				})
			);
		}

		return this.registry.geometry(key);
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
			2000
		);

		// three r160 eclaire en mode physique, les intensites sont divisees
		// par pi par rapport a l'ancien mode, d'ou des valeurs au-dessus de 1
		// le ciel et le sol teintent legerement les faces pour les distinguer
		this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b5a48, 2.2));
		const directional = new THREE.DirectionalLight(0xffffff, 1.6);
		directional.position.set(120, 220, 140);
		this.scene.add(directional);

		this.salon = buildSalon(this.scene, this.registry);
		this.desks = new DeskManager(this.salon.deskAnchors);

		this.player = new THREE.Mesh(
			this.registry.geometry('avatar'),
			voxelMaterial()
		);

		const spawn = spawnPoint();
		this.player.position.set(spawn.x, 0, spawn.z);
		this.scene.add(this.player);

		// surbrillance de la case courante
		const planeGeom = new THREE.PlaneGeometry(TILE, TILE);
		const planeMat = new THREE.MeshBasicMaterial({
			color: 0xffff66,
			opacity: 0.25,
			transparent: true,
			side: THREE.DoubleSide,
		});
		this.highlight = new THREE.Mesh(planeGeom, planeMat);
		this.highlight.rotation.x = -Math.PI / 2;
		this.highlight.position.set(spawn.x, 0.1, spawn.z);
		this.scene.add(this.highlight);

		this.syncCamera();

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

	// la camera suit le joueur, sinon il sort du cadre dans les coins
	// y ignore pour que la camera ne saute pas avec l'avatar
	private syncCamera() {
		const focus = new THREE.Vector3(
			this.player.position.x,
			0,
			this.player.position.z
		);
		this.camera.position.copy(focus).add(this.cameraOffset);
		this.camera.lookAt(focus);
	}

	private bindEvents() {
		const onKeyDown = (e: KeyboardEvent) => {
			// pas de deplacement quand on tape dans un input
			const tag = document.activeElement?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;
			if (this.inputLocked) return;

			const key = e.key.toLowerCase();

			if (key === 'e') {
				if (this.targetedDesk) this.onOpenDesk(this.targetedDesk);
				return;
			}

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
		if (!this.joystick.active || this.inputLocked) return;

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
		const from = this.targetPos ?? this.player.position;
		const newX = Math.round(from.x) + dx;
		const newZ = Math.round(from.z) + dz;

		// murs et mobilier bloquent le deplacement
		if (!isWalkable(newX, newZ)) return;

		this.targetPos = new THREE.Vector3(newX, 0, newZ);

		// l'avatar regarde dans le sens du deplacement
		this.player.rotation.y = Math.atan2(dx, dz);
	}

	// point au-dessus de la tete d'un joueur, en pixels dans la fenetre
	// null si le joueur n'est pas (ou plus) dans la scene
	screenPositionOf(playerId: string): { x: number; y: number } | null {
		const mesh =
			playerId === this.network?.playerId
				? this.player
				: this.network?.otherPlayers.get(playerId);
		if (!mesh) return null;

		const point = new THREE.Vector3(
			mesh.position.x,
			BUBBLE_ANCHOR_Y,
			mesh.position.z
		).project(this.camera);
		const rect = this.renderer.domElement.getBoundingClientRect();

		return {
			x: rect.left + ((point.x + 1) / 2) * rect.width,
			y: rect.top + ((1 - point.y) / 2) * rect.height,
		};
	}

	private updateDeskTarget() {
		const found = this.desks.nearest(this.player.position, DESK_REACH);

		// le proprietaire et l'id arrivent apres la detection, on remonte
		// aussi leurs changements sinon l'invite reste sur l'ancien etat
		const signature = found
			? `${found.slotIndex}:${found.deskId}:${
					found.occupant?.username ?? ''
				}`
			: '';

		this.targetedDesk = found;
		this.desks.highlight(found ? found.slotIndex : null);

		if (signature !== this.targetSignature) {
			this.targetSignature = signature;
			this.onDeskTargetChange(found);
		}
	}

	animate() {
		if (this.disposed) return;
		this.rafId = requestAnimationFrame(() => this.animate());

		if (this.targetPos) {
			this.player.position.lerp(this.targetPos, this.moveLerp);

			// distance au sol, y bouge avec l'animation de marche
			const dx = this.targetPos.x - this.player.position.x;
			const dz = this.targetPos.z - this.player.position.z;

			if (dx * dx + dz * dz < 0.01) {
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
			this.syncCamera();
		}

		const time = this.clock.getElapsedTime();
		animateAvatar(this.player, this.targetPos !== null, time);

		this.updateDeskTarget();

		if (this.network) this.network.update(time);
		if (this.interactions) this.interactions.update();

		this.renderer.render(this.scene, this.camera);
	}

	destroy() {
		this.disposed = true;
		if (this.rafId) cancelAnimationFrame(this.rafId);
		this.cleanups.forEach((fn) => fn());
		this.cleanups = [];

		this.desks?.dispose();
		this.salon?.dispose();

		this.highlight.geometry.dispose();
		(this.highlight.material as THREE.Material).dispose();

		this.registry.dispose();
		voxelMaterial().dispose();

		this.renderer.dispose();
		this.renderer.domElement.parentNode?.removeChild(
			this.renderer.domElement
		);
	}
}
