/** @format */

import * as THREE from 'three';
import { io, type Socket } from 'socket.io-client';
import type { GameEngine } from './engine';
import type {
	ChatMessage,
	PlayerData,
	PlayerMesh,
	PrivateMessage,
} from './types';

interface NetworkOptions {
	url?: string;
	guestUsername?: string;
	onStatus?: (connected: boolean) => void;
	onChat?: (message: ChatMessage) => void;
	onPrivateMessage?: (message: PrivateMessage) => void;
}

export class NetworkClient {
	engine: GameEngine;
	socket: Socket | null = null;
	playerId: string | null = null;
	otherPlayers = new Map<string, PlayerMesh>();
	serverUrl: string;

	private guestUsername?: string;
	private onStatus: (connected: boolean) => void;
	private onChat: (message: ChatMessage) => void;
	private onPrivateMessage: (message: PrivateMessage) => void;

	constructor(
		engine: GameEngine,
		{
			url,
			guestUsername,
			onStatus,
			onChat,
			onPrivateMessage,
		}: NetworkOptions = {}
	) {
		this.engine = engine;
		this.serverUrl = url || 'http://localhost:3000';
		this.guestUsername = guestUsername;
		this.onStatus = onStatus || (() => {});
		this.onChat = onChat || (() => {});
		this.onPrivateMessage = onPrivateMessage || (() => {});

		this.init();
	}

	private init() {
		this.socket = io(this.serverUrl, {
			transports: ['websocket', 'polling'],
			withCredentials: true,

			// Utilisé uniquement lorsque le joueur n'est pas connecté.
			auth: {
				guestUsername: this.guestUsername,
			},

			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
		});

		this.bindSocketEvents();
	}

	private bindSocketEvents() {
		const socket = this.socket;
		if (!socket) return;

		socket.on('connect', () => this.onStatus(true));
		socket.on('disconnect', () => this.onStatus(false));
		socket.on('connect_error', () => this.onStatus(false));

		socket.on(
			'init',
			(data: { playerId: string; player: PlayerData }) => {
				this.playerId = data.playerId;

				if (this.engine.player && data.player.color) {
					this.engine.player.material.color.setHex(
						data.player.color
					);
				}

				if (
					typeof data.player.x === 'number' &&
					typeof data.player.y === 'number' &&
					typeof data.player.z === 'number'
				) {
					this.engine.player.position.set(
						data.player.x,
						data.player.y,
						data.player.z
					);
				}
			}
		);

		socket.on('currentPlayers', (players: PlayerData[]) => {
			players.forEach((player) => {
				if (player.id !== this.playerId) {
					this.addOtherPlayer(player);
				}
			});
		});

		socket.on('playerJoined', (player: PlayerData) => {
			this.addOtherPlayer(player);
		});

		socket.on(
			'playerMoved',
			(data: {
				id: string;
				x: number;
				y: number;
				z: number;
			}) => {
				const otherPlayer = this.otherPlayers.get(data.id);

				if (otherPlayer) {
					otherPlayer.targetPos = new THREE.Vector3(
						data.x,
						data.y,
						data.z
					);
				}
			}
		);

		socket.on('playerLeft', (playerId: string) => {
			this.removeOtherPlayer(playerId);
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

	private addOtherPlayer(playerData: PlayerData) {
		if (this.otherPlayers.has(playerData.id)) return;

		const geometry = new THREE.BoxGeometry(10, 10, 10);

		const material = new THREE.MeshStandardMaterial({
			color: playerData.color || 0xff6b6b,
		});

		const mesh = new THREE.Mesh(
			geometry,
			material
		) as PlayerMesh;

		mesh.position.set(
			playerData.x,
			playerData.y,
			playerData.z
		);

		mesh.userData.playerId = playerData.id;
		mesh.userData.username = playerData.username;
		mesh.targetPos = null;

		this.engine.scene.add(mesh);
		this.otherPlayers.set(playerData.id, mesh);
		this.addPlayerLabel(mesh, playerData.username);
	}

	private removeOtherPlayer(playerId: string) {
		const player = this.otherPlayers.get(playerId);

		if (!player) return;

		this.engine.scene.remove(player);

		player.geometry.dispose();

		if (Array.isArray(player.material)) {
			player.material.forEach((material) => material.dispose());
		} else {
			player.material.dispose();
		}

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
		sprite.position.y = 15;

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

	update() {
		this.otherPlayers.forEach((player) => {
			if (!player.targetPos) return;

			player.position.lerp(player.targetPos, 0.15);

			if (
				player.position.distanceToSquared(player.targetPos) <
				0.01
			) {
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
			player.geometry.dispose();

			if (Array.isArray(player.material)) {
				player.material.forEach((material) =>
					material.dispose()
				);
			} else {
				player.material.dispose();
			}
		});

		this.otherPlayers.clear();
	}
}