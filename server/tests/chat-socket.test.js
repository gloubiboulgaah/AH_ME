/** @format */

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { attach } = require('../src/modules/chat/socket');
const { players } = require('../src/modules/world/socket');

function setup(player = { username: 'Alice' }) {
	const handlers = new Map();
	const events = [];
	const privateEvents = [];

	const socket = {
		id: 'socket-alice',
		on(event, handler) {
			handlers.set(event, handler);
		},
	};

	const io = {
		emit(event, payload) {
			events.push({ event, payload });
		},
		to(target) {
			return {
				emit(event, payload) {
					privateEvents.push({
						target,
						event,
						payload,
					});
				},
			};
		},
	};

	if (player) {
		players.set(socket.id, player);
	}

	attach(io, socket);

	return {
		events,
		privateEvents,
		send(event, payload) {
			const handler = handlers.get(event);
			assert.ok(handler, `Événement inconnu : ${event}`);
			handler(payload);
		},
	};
}

afterEach(() => {
	players.clear();
});

test('diffuse un message public valide', () => {
	const chat = setup();

	chat.send('chatMessage', 'Bonjour');

	assert.equal(chat.events.length, 1);
	assert.equal(chat.events[0].event, 'chatMessage');
	assert.equal(chat.events[0].payload.username, 'Alice');
	assert.equal(chat.events[0].payload.message, 'Bonjour');
	assert.equal(typeof chat.events[0].payload.timestamp, 'number');
});

test('supprime les espaces inutiles dans les messages', () => {
	const chat = setup();

	chat.send('chatMessage', '   Bonjour tout le monde   ');

	assert.equal(chat.events[0].payload.message, 'Bonjour tout le monde');
});

test('ignore les messages vides', () => {
	const chat = setup();

	chat.send('chatMessage', '    ');

	assert.equal(chat.events.length, 0);
});

test('ignore les messages qui ne sont pas du texte', () => {
	const chat = setup();

	chat.send('chatMessage', { message: 'Bonjour' });

	assert.equal(chat.events.length, 0);
});

test('ignore les messages des joueurs absents', () => {
	const chat = setup(null);

	chat.send('chatMessage', 'Bonjour');

	assert.equal(chat.events.length, 0);
});

test('limite les messages publics à 300 caractères', () => {
	const chat = setup();

	chat.send('chatMessage', 'A'.repeat(500));

	assert.equal(chat.events[0].payload.message.length, 300);
});

test('envoie un message privé au destinataire demandé', () => {
	const chat = setup();

	chat.send('privateMessage', {
		to: 'socket-bob',
		message: 'Salut Bob',
	});

	assert.equal(chat.privateEvents.length, 1);
	assert.equal(chat.privateEvents[0].target, 'socket-bob');
	assert.equal(chat.privateEvents[0].event, 'privateMessage');
	assert.equal(chat.privateEvents[0].payload.from, 'socket-alice');
	assert.equal(chat.privateEvents[0].payload.fromUsername, 'Alice');
	assert.equal(chat.privateEvents[0].payload.message, 'Salut Bob');
});

test('refuse un message privé sans destinataire', () => {
	const chat = setup();

	chat.send('privateMessage', {
		message: 'Bonjour',
	});

	assert.equal(chat.privateEvents.length, 0);
});

test('refuse un message privé vide', () => {
	const chat = setup();

	chat.send('privateMessage', {
		to: 'socket-bob',
		message: '   ',
	});

	assert.equal(chat.privateEvents.length, 0);
});

test('limite les messages privés à 300 caractères', () => {
	const chat = setup();

	chat.send('privateMessage', {
		to: 'socket-bob',
		message: 'B'.repeat(500),
	});

	assert.equal(chat.privateEvents[0].payload.message.length, 300);
});

test('envoie une émote au joueur ciblé', () => {
	const chat = setup();

	chat.send('emote', {
		to: 'socket-bob',
		type: 'wave',
	});

	assert.equal(chat.privateEvents.length, 1);
	assert.equal(chat.privateEvents[0].event, 'emote');
	assert.equal(chat.privateEvents[0].target, 'socket-bob');
	assert.equal(chat.privateEvents[0].payload.type, 'wave');
	assert.equal(chat.privateEvents[0].payload.fromUsername, 'Alice');
});

test('ignore une émote sans type', () => {
	const chat = setup();

	chat.send('emote', {
		to: 'socket-bob',
	});

	assert.equal(chat.privateEvents.length, 0);
});

test('ignore une émote sans destinataire', () => {
	const chat = setup();

	chat.send('emote', {
		type: 'wave',
	});

	assert.equal(chat.privateEvents.length, 0);
});

test('ignore les émotes envoyées par un joueur absent', () => {
	const chat = setup(null);

	chat.send('emote', {
		to: 'socket-bob',
		type: 'wave',
	});

	assert.equal(chat.privateEvents.length, 0);
});
