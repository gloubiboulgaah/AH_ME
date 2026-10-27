/** @format */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const URL = process.env.TEST_SOCKET_URL || 'http://localhost:3000';
const TIMEOUT = 5000;

function waitFor(socket, event, predicate = () => true) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			socket.off(event, handler);
			reject(new Error(`Timeout waiting for ${event}`));
		}, TIMEOUT);

		function handler(data) {
			if (!predicate(data)) return;

			clearTimeout(timer);
			socket.off(event, handler);
			resolve(data);
		}

		socket.on(event, handler);
	});
}

async function connectPlayer(username) {
	const socket = io(URL, {
		autoConnect: false,
		transports: ['websocket'],
		reconnection: false,
		auth: { guestUsername: username },
	});

	const connected = waitFor(socket, 'connect');
	const initialized = waitFor(socket, 'init');
	const deskList = waitFor(socket, 'deskList');

	socket.connect();

	try {
		await connected;
		const init = await initialized;
		const desks = await deskList;

		return { socket, init, desks };
	} catch (error) {
		socket.disconnect();
		throw error;
	}
}

test('real Socket.IO integration between two guests', async () => {
	const clients = [];

	try {
		const alice = await connectPlayer('AliceTest');
		clients.push(alice.socket);

		assert.equal(alice.init.playerId, alice.socket.id);
		assert.equal(alice.init.player.username, 'AliceTest');
		assert.equal(alice.desks.mySlotIndex, null);

		const joined = waitFor(
			alice.socket,
			'playerJoined',
			(player) => player.username === 'BobTest'
		);

		const bob = await connectPlayer('BobTest');
		clients.push(bob.socket);

		const joinedPlayer = await joined;

		assert.equal(joinedPlayer.id, bob.socket.id);
		assert.equal(bob.init.playerId, bob.socket.id);
		assert.equal(bob.desks.mySlotIndex, null);

		// Movement must reach the other player.
		const moved = waitFor(
			bob.socket,
			'playerMoved',
			(data) => data.id === alice.socket.id
		);

		alice.socket.emit('playerMove', {
			x: 12,
			y: 5,
			z: 8,
		});

		const position = await moved;

		assert.equal(position.x, 12);
		assert.equal(position.y, 5);
		assert.equal(position.z, 8);

		// Public chat must reach both players.
		const aliceChat = waitFor(
			alice.socket,
			'chatMessage',
			(data) => data.message === 'Bonjour Bob'
		);

		const bobChat = waitFor(
			bob.socket,
			'chatMessage',
			(data) => data.message === 'Bonjour Bob'
		);

		alice.socket.emit('chatMessage', '  Bonjour Bob  ');

		const [receivedByAlice, receivedByBob] = await Promise.all([
			aliceChat,
			bobChat,
		]);

		assert.equal(receivedByAlice.playerId, alice.socket.id);
		assert.equal(receivedByBob.username, 'AliceTest');

		const privateMessage = waitFor(
			bob.socket,
			'privateMessage',
			(data) => data.message === 'Message prive'
		);

		alice.socket.emit('privateMessage', {
			to: bob.socket.id,
			message: 'Message prive',
		});

		const receivedPrivate = await privateMessage;

		assert.equal(receivedPrivate.from, alice.socket.id);
		assert.equal(receivedPrivate.fromUsername, 'AliceTest');

		const emote = waitFor(
			bob.socket,
			'emote',
			(data) => data.type === 'wave'
		);

		alice.socket.emit('emote', {
			to: bob.socket.id,
			type: 'wave',
		});

		const receivedEmote = await emote;

		assert.equal(receivedEmote.from, alice.socket.id);

		const bobId = bob.socket.id;

		const left = waitFor(alice.socket, 'playerLeft', (id) => id === bobId);

		bob.socket.disconnect();

		const disconnectedPlayerId = await left;

		assert.equal(disconnectedPlayerId, bobId);
	} finally {
		for (const socket of clients) {
			socket.disconnect();
		}
	}
});
