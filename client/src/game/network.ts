/** @format */

import * as THREE from 'three';
import { io, type Socket } from 'socket.io-client';
import type { GameEngine } from './engine';
import type { AvatarAppearance } from '@/lib/avatar';
import { voxelMaterial } from './voxel/registry';
import { animateAvatar } from './avatarMotion';
import type {
	ChatMessage,
	DeskSummary,
	PlayerData,
	PlayerMesh,
	PrivateMessage,
} from './types';

interface NetworkOptions {
	url?: string;
	guestUsername?: string;
	avatar?: AvatarAppearance | null;
	onStatus?: (connected: boolean) => void;
	onChat?: (message: ChatMessage) => void;
	onPrivateMessage?: (message: PrivateMessage) => void;
	// index du bureau attribue au joueur, null si le salon est plein
	onMyDesk?: (slotIndex: number | null) => void;
	onDeskFull?: () => void;
	// nombre de joueurs dans le salon, soi compris
	onPlayerCount?: (count: number) => void;
}

export class NetworkClient {
	engine: GameEngine;
	socket: Socket | null = null;
	playerId: string | null = null;
	mySlotIndex: number | null = null;
	otherPlayers = new Map<string, PlayerMesh>();
	serverUrl: string;

	private guestUsername?: string;
	private avatar: AvatarAppearance | null;
	private onStatus: (connected: boolean) => void;
	private onChat: (message: ChatMessage) => void;
	private onPrivateMessage: (message: PrivateMessage) => void;
	private onMyDesk: (slotIndex: number | null) => void;
	private onDeskFull: () => void;
	private onPlayerCount: (count: number) => void;

	constructor(engine: GameEngine, options: NetworkOptions = {}) {
		this.engine = engine;
		this.serverUrl = options.url || 'http://localhost:3000';
		this.guestUsername = options.guestUsername;
		this.avatar = options.avatar ?? null;
		this.onStatus = options.onStatus ?? (() => {});
		this.onChat = options.onChat ?? (() => {});
		this.onPrivateMessage = options.onPrivateMessage ?? (() => {});
		this.onMyDesk = options.onMyDesk ?? (() => {});
		this.onDeskFull = options.onDeskFull ?? (() => {});
		this.onPlayerCount = options.onPlayerCount ?? (() => {});

		this.init();
	}

	private init() {
		this.socket = io(this.serverUrl, {
			transports: ['websocket', 'polling'],
			withCredentials: true,

			// utilise uniquement lorsque le joueur n'est pas connecte
			auth: {
				guestUsername: this.guestUsername,
				// valide cote serveur, sauvegarde si le joueur a un compte
				avatar: this.avatar,
			},

			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
		});

		this.bindSocketEvents();
		this.bindDeskEvents();
	}

	private bindSocketEvents() {
		const socket = this.socket;
		if (!socket) return;

		socket.on('connect', () => this.onStatus(true));
		socket.on('disconnect', () => {
			this.onStatus(false);
			this.onPlayerCount(0);
		});
		socket.on('connect_error', () => this.onStatus(false));

		socket.on('init', (data: { playerId: string; player: PlayerData }) => {
			this.playerId = data.playerId;

			this.engine.player.geometry = this.engine.avatarGeometryFor(
				data.player
			);

			// y ignore, les modeles voxel sont ancres sur leurs pieds
			if (
				typeof data.player.x === 'number' &&
				typeof data.player.z === 'number'
			) {
				this.engine.player.position.set(
					data.player.x,
					0,
					data.player.z
				);
			}
		});

		socket.on('currentPlayers', (players: PlayerData[]) => {
			players.forEach((player) => {
				if (player.id !== this.playerId) {
					this.addOtherPlayer(player);
				}
			});
			this.emitPlayerCount();
		});

		socket.on('playerJoined', (player: PlayerData) => {
			this.addOtherPlayer(player);
			this.emitPlayerCount();
		});

		socket.on(
			'playerMoved',
			(data: { id: string; x: number; y: number; z: number }) => {
				const otherPlayer = this.otherPlayers.get(data.id);

				if (otherPlayer) {
					otherPlayer.targetPos = new THREE.Vector3(
						data.x,
						0,
						data.z
					);
				}
			}
		);

		socket.on('playerLeft', (playerId: string) => {
			this.removeOtherPlayer(playerId);
			this.emitPlayerCount();
		});

		socket.on('chatMessage', (data: ChatMessage) => {
			this.onChat(data);
		});

		socket.on('privateMessage', (data: PrivateMessage) => {
			this.onPrivateMessage(data);

			if (this.engine.interactions) {
				this.engine.interactions.receivePrivateMessage(data);
			}
		});
	}

	private bindDeskEvents() {
		const socket = this.socket;
		if (!socket) return;

		socket.on(
			'deskList',
			(data: { mySlotIndex: number | null; desks: DeskSummary[] }) => {
				data.desks.forEach((desk) => {
					this.engine.desks.setDeskId(desk.slotIndex, desk.deskId);

					if (desk.userId && desk.username) {
						this.engine.desks.setOccupant(desk.slotIndex, {
							userId: desk.userId,
							username: desk.username,
						});
					} else {
						this.engine.desks.clearOccupant(desk.slotIndex);
					}

					this.engine.desks.setContent(desk.slotIndex, desk.content);
				});

				this.mySlotIndex = data.mySlotIndex;
				this.onMyDesk(data.mySlotIndex);
			}
		);

		socket.on(
			'deskAssigned',
			(data: {
				deskId: number;
				slotIndex: number;
				userId: number;
				username: string;
				content: { files: number; notes: number };
			}) => {
				this.engine.desks.setDeskId(data.slotIndex, data.deskId);
				this.engine.desks.setOccupant(data.slotIndex, {
					userId: data.userId,
					username: data.username,
				});
				this.engine.desks.setContent(data.slotIndex, data.content);
			}
		);

		socket.on('deskReleased', (data: { slotIndex: number }) => {
			this.engine.desks.clearOccupant(data.slotIndex);
		});

		socket.on(
			'deskContent',
			(data: {
				slotIndex: number;
				content: { files: number; notes: number };
			}) => {
				this.engine.desks.setContent(data.slotIndex, data.content);
			}
		);

		socket.on('deskFull', () => this.onDeskFull());
	}

	private emitPlayerCount() {
		this.onPlayerCount(this.otherPlayers.size + 1);
	}

	private addOtherPlayer(playerData: PlayerData) {
		if (this.otherPlayers.has(playerData.id)) return;

		const geometry = this.engine.avatarGeometryFor(playerData);
		const mesh = new THREE.Mesh(geometry, voxelMaterial()) as PlayerMesh;

		mesh.position.set(playerData.x, 0, playerData.z);

		mesh.userData.playerId = playerData.id;
		mesh.userData.username = playerData.username;
		mesh.targetPos = null;

		this.engine.scene.add(mesh);
		this.otherPlayers.set(playerData.id, mesh);
		this.addPlayerLabel(mesh, playerData.username);
	}

	// la geometrie appartient au registre voxel, seul le label est a liberer
	private disposeLabel(player: PlayerMesh) {
		const label = player.userData.label;
		if (!label) return;

		label.material.map?.dispose();
		label.material.dispose();
	}

	private removeOtherPlayer(playerId: string) {
		const player = this.otherPlayers.get(playerId);

		if (!player) return;

		this.engine.scene.remove(player);
		this.disposeLabel(player);
		this.otherPlayers.delete(playerId);
	}

	private addPlayerLabel(mesh: PlayerMesh, username: string) {
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');

		if (!context) return;

		canvas.width = 256;
		canvas.height = 64;

		context.fillStyle = 'rgba(0, 0, 0, 0.6)';
		context.fillRect(0, 0, canvas.width, canvas.height);

		context.font = 'bold 24px Arial';
		context.fillStyle = 'white';
		context.textAlign = 'center';
		context.fillText(username, 128, 40);

		const texture = new THREE.CanvasTexture(canvas);

		const sprite = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: texture,
			})
		);

		sprite.scale.set(20, 5, 1);
		sprite.position.y = 20;

		mesh.add(sprite);
		mesh.userData.label = sprite;
	}

	sendPlayerPosition(x: number, y: number, z: number) {
		if (!this.socket?.connected) return;

		this.socket.emit('playerMove', {
			x,
			y,
			z,
		});
	}

	sendChatMessage(message: string) {
		const trimmedMessage = message.trim();

		if (!this.socket?.connected || !trimmedMessage) return;

		this.socket.emit('chatMessage', trimmedMessage);
	}

	// a rappeler apres un depot ou un post-it pour rafraichir l'apparence 3D
	requestDeskContent(slotIndex: number, deskId: number | null) {
		if (!this.socket?.connected || deskId === null) return;
		this.socket.emit('deskContent', { slotIndex, deskId });
	}

	update(time: number) {
		this.otherPlayers.forEach((player) => {
			animateAvatar(player, Boolean(player.targetPos), time);
			if (!player.targetPos) return;

			// l'avatar regarde dans le sens du deplacement
			const dx = player.targetPos.x - player.position.x;
			const dz = player.targetPos.z - player.position.z;

			if (Math.abs(dx) > 0.5 || Math.abs(dz) > 0.5) {
				player.rotation.y = Math.atan2(dx, dz);
			}

			player.position.lerp(player.targetPos, 0.15);

			// distance au sol, y bouge avec l'animation de marche
			if (dx * dx + dz * dz < 0.01) {
				player.position.copy(player.targetPos);
				player.targetPos = null;
			}
		});
	}

	destroy() {
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
		}

		this.otherPlayers.forEach((player) => {
			this.engine.scene.remove(player);
			this.disposeLabel(player);
		});

		this.otherPlayers.clear();
	}
}
