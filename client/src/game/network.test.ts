/** @format */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { io } from 'socket.io-client';
import { NetworkClient } from './network';
import type { GameEngine } from './engine';

vi.mock('socket.io-client', () => ({
	io: vi.fn(),
}));

vi.mock('./voxel/registry', () => ({
	voxelMaterial: vi.fn(() => new THREE.MeshBasicMaterial()),
}));

vi.mock('./avatarMotion', () => ({
	animateAvatar: vi.fn(),
}));

type Handler = (...args: any[]) => void;

function createSocket() {
	const handlers = new Map<string, Handler>();

	return {
		connected: true,
		on: vi.fn((event: string, handler: Handler) => {
			handlers.set(event, handler);
		}),
		emit: vi.fn(),
		removeAllListeners: vi.fn(),
		disconnect: vi.fn(),
		trigger(event: string, data?: unknown) {
			const handler = handlers.get(event);
			if (!handler) throw new Error(`Missing handler: ${event}`);
			handler(data);
		},
	};
}

function createEngine() {
	const player = new THREE.Mesh(
		new THREE.BoxGeometry(1, 1, 1),
		new THREE.MeshBasicMaterial()
	);

	return {
		player,
		scene: new THREE.Scene(),
		avatarGeometryFor: vi.fn(() => new THREE.BoxGeometry(1, 2, 1)),
		desks: {
			setDeskId: vi.fn(),
			setOccupant: vi.fn(),
			clearOccupant: vi.fn(),
			setContent: vi.fn(),
		},
		interactions: {
			receivePrivateMessage: vi.fn(),
		},
	};
}

describe('NetworkClient', () => {
	let socket: ReturnType<typeof createSocket>;
	let engine: ReturnType<typeof createEngine>;

	beforeEach(() => {
		vi.clearAllMocks();

		socket = createSocket();
		engine = createEngine();

		vi.mocked(io).mockReturnValue(
			socket as unknown as ReturnType<typeof io>
		);

		vi.stubGlobal('document', {
			createElement: () => ({
				getContext: () => null,
			}),
		});
	});

	it('configures the socket connection', () => {
		const avatar = { skin: '#abcdef', build: 'standard' as const };

		const client = new NetworkClient(engine as unknown as GameEngine, {
			url: 'http://localhost:4000',
			guestUsername: 'Alice',
			avatar,
		});

		expect(io).toHaveBeenCalledWith(
			'http://localhost:4000',
			expect.objectContaining({
				withCredentials: true,
				auth: {
					guestUsername: 'Alice',
					avatar,
				},
			})
		);

		client.destroy();
	});

	it('reports connection and disconnection', () => {
		const onStatus = vi.fn();
		const onPlayerCount = vi.fn();

		const client = new NetworkClient(engine as unknown as GameEngine, {
			onStatus,
			onPlayerCount,
		});

		socket.trigger('connect');
		expect(onStatus).toHaveBeenCalledWith(true);

		socket.trigger('disconnect');
		expect(onStatus).toHaveBeenCalledWith(false);
		expect(onPlayerCount).toHaveBeenCalledWith(0);

		client.destroy();
	});

	it('initializes the local player', () => {
		const client = new NetworkClient(engine as unknown as GameEngine);

		socket.trigger('init', {
			playerId: 'player-1',
			player: {
				id: 'player-1',
				username: 'Alice',
				x: 12,
				y: 5,
				z: 8,
			},
		});

		expect(client.playerId).toBe('player-1');
		expect(engine.player.position.toArray()).toEqual([12, 0, 8]);
		expect(engine.avatarGeometryFor).toHaveBeenCalled();

		client.destroy();
	});

	it('sends positions and non-empty chat messages only when connected', () => {
		const client = new NetworkClient(engine as unknown as GameEngine);

		client.sendPlayerPosition(1, 2, 3);
		client.sendChatMessage('  Bonjour  ');
		client.sendChatMessage('   ');

		expect(socket.emit).toHaveBeenCalledWith('playerMove', {
			x: 1,
			y: 2,
			z: 3,
		});
		expect(socket.emit).toHaveBeenCalledWith('chatMessage', 'Bonjour');
		expect(socket.emit).toHaveBeenCalledTimes(2);

		socket.connected = false;
		client.sendPlayerPosition(4, 5, 6);
		client.sendChatMessage('Test');

		expect(socket.emit).toHaveBeenCalledTimes(2);

		client.destroy();
	});

	it('updates desk information received from the server', () => {
		const onMyDesk = vi.fn();
		const client = new NetworkClient(engine as unknown as GameEngine, {
			onMyDesk,
		});

		socket.trigger('deskList', {
			mySlotIndex: 2,
			desks: [
				{
					deskId: 10,
					slotIndex: 2,
					userId: 7,
					username: 'Alice',
					content: { files: 1, notes: 2 },
				},
			],
		});

		expect(client.mySlotIndex).toBe(2);
		expect(onMyDesk).toHaveBeenCalledWith(2);
		expect(engine.desks.setDeskId).toHaveBeenCalledWith(2, 10);
		expect(engine.desks.setOccupant).toHaveBeenCalledWith(2, {
			userId: 7,
			username: 'Alice',
		});
		expect(engine.desks.setContent).toHaveBeenCalledWith(2, {
			files: 1,
			notes: 2,
		});

		socket.trigger('deskReleased', { slotIndex: 2 });
		expect(engine.desks.clearOccupant).toHaveBeenCalledWith(2);

		client.destroy();
	});

	it('requests desk content only with a connected socket and a desk ID', () => {
		const client = new NetworkClient(engine as unknown as GameEngine);

		client.requestDeskContent(3, 15);
		client.requestDeskContent(3, null);

		expect(socket.emit).toHaveBeenCalledExactlyOnceWith('deskContent', {
			slotIndex: 3,
			deskId: 15,
		});

		socket.connected = false;
		client.requestDeskContent(3, 15);

		expect(socket.emit).toHaveBeenCalledTimes(1);

		client.destroy();
	});

	it('forwards chat, private messages and server notifications', () => {
		const onChat = vi.fn();
		const onPrivateMessage = vi.fn();
		const onDeskFull = vi.fn();
		const onKicked = vi.fn();

		const client = new NetworkClient(engine as unknown as GameEngine, {
			onChat,
			onPrivateMessage,
			onDeskFull,
			onKicked,
		});

		const chat = { username: 'Alice', message: 'Bonjour' };
		const privateMessage = {
			from: 'player-2',
			message: 'Salut',
		};

		socket.trigger('chatMessage', chat);
		socket.trigger('privateMessage', privateMessage);
		socket.trigger('deskFull');
		socket.trigger('serverKicked');

		expect(onChat).toHaveBeenCalledWith(chat);
		expect(onPrivateMessage).toHaveBeenCalledWith(privateMessage);
		expect(engine.interactions.receivePrivateMessage).toHaveBeenCalledWith(
			privateMessage
		);
		expect(onDeskFull).toHaveBeenCalledOnce();
		expect(onKicked).toHaveBeenCalledOnce();

		client.destroy();
	});

	it('removes listeners and disconnects on destroy', () => {
		const client = new NetworkClient(engine as unknown as GameEngine);

		client.destroy();

		expect(socket.removeAllListeners).toHaveBeenCalledOnce();
		expect(socket.disconnect).toHaveBeenCalledOnce();
		expect(client.socket).toBeNull();
		expect(client.otherPlayers.size).toBe(0);
	});

	it('adds a remote player to the scene when they join', () => {
		const onPlayerCount = vi.fn();

		const client = new NetworkClient(engine as unknown as GameEngine, {
			onPlayerCount,
		});

		const bob = {
			id: 'player-bob',
			username: 'Bob',
			x: 2,
			y: 5,
			z: 3,
		};

		socket.trigger('playerJoined', bob);

		const avatar = client.otherPlayers.get(bob.id);

		expect(avatar).toBeDefined();
		expect(engine.scene.children).toContain(avatar);
		expect(avatar?.position.toArray()).toEqual([2, 0, 3]);
		expect(avatar?.userData.playerId).toBe(bob.id);
		expect(avatar?.userData.username).toBe('Bob');
		expect(onPlayerCount).toHaveBeenCalledWith(2);

		socket.trigger('playerJoined', bob);

		expect(client.otherPlayers.size).toBe(1);
		expect(engine.scene.children).toHaveLength(1);

		client.destroy();
	});

	it('updates the target position of a remote player', () => {
		const client = new NetworkClient(engine as unknown as GameEngine);

		socket.trigger('playerJoined', {
			id: 'player-bob',
			username: 'Bob',
			x: 2,
			y: 0,
			z: 3,
		});

		const avatar = client.otherPlayers.get('player-bob');

		expect(avatar).toBeDefined();

		socket.trigger('playerMoved', {
			id: 'player-bob',
			x: 5,
			y: 10,
			z: 8,
		});

		expect(avatar?.targetPos?.toArray()).toEqual([5, 0, 8]);
		expect(avatar?.position.toArray()).toEqual([2, 0, 3]);

		client.update(0);

		expect(avatar?.position.x).toBeCloseTo(2.45);
		expect(avatar?.position.y).toBe(0);
		expect(avatar?.position.z).toBeCloseTo(3.75);

		client.destroy();
	});

	it('removes a remote player from the scene when they leave', () => {
		const onPlayerCount = vi.fn();

		const client = new NetworkClient(engine as unknown as GameEngine, {
			onPlayerCount,
		});

		socket.trigger('playerJoined', {
			id: 'player-bob',
			username: 'Bob',
			x: 2,
			y: 0,
			z: 3,
		});

		socket.trigger('playerJoined', {
			id: 'player-charlie',
			username: 'Charlie',
			x: 5,
			y: 0,
			z: 8,
		});

		const bobAvatar = client.otherPlayers.get('player-bob');
		const charlieAvatar = client.otherPlayers.get('player-charlie');

		expect(client.otherPlayers.size).toBe(2);
		expect(onPlayerCount).toHaveBeenLastCalledWith(3);

		socket.trigger('playerLeft', 'player-bob');

		expect(client.otherPlayers.has('player-bob')).toBe(false);
		expect(engine.scene.children).not.toContain(bobAvatar);

		expect(client.otherPlayers.get('player-charlie')).toBe(charlieAvatar);
		expect(engine.scene.children).toContain(charlieAvatar);
		expect(onPlayerCount).toHaveBeenLastCalledWith(2);

		client.destroy();
	});
});
