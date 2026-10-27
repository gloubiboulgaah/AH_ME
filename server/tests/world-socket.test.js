/** @format */

const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const service = require('../src/modules/world/service');
const { attach, players } = require('../src/modules/world/socket');

let nextId = 1;

async function setup({ user = { id: 10 }, avatar = undefined } = {}) {
	const id = `socket-${nextId++}`;
	const handlers = new Map();
	const emitted = [];
	const broadcast = [];

	const socket = {
		id,
		data: {
			user,
			username: 'Alice',
		},
		handshake: {
			auth: { avatar },
		},
		on(event, handler) {
			handlers.set(event, handler);
		},
		emit(event, payload) {
			emitted.push({ event, payload });
		},
		broadcast: {
			emit(event, payload) {
				broadcast.push({ event, payload });
			},
		},
	};

	attach({}, socket);

	for (let i = 0; i < 20; i++) {
		if (emitted.some((item) => item.event === 'init')) break;
		await new Promise((resolve) => setImmediate(resolve));
	}

	return {
		id,
		emitted,
		broadcast,
		send(event, payload) {
			assert.ok(handlers.has(event));
			return handlers.get(event)(payload);
		},
	};
}

async function withMocks(callback, saved = null) {
	const handles = [
		mock.method(service, 'loadPlayer', async () => saved),
		mock.method(service, 'savePlayer', async () => {}),
	];

	try {
		await callback();
	} finally {
		for (const handle of handles.reverse()) {
			handle.mock.restore();
		}
	}
}

afterEach(() => {
	players.clear();
});

test('initialise un joueur avec sa position par défaut', async () => {
	await withMocks(async () => {
		const s = await setup();
		const player = players.get(s.id);

		assert.equal(player.x, 0);
		assert.equal(player.y, 5);
		assert.equal(player.z, 0);
		assert.equal(player.userId, 10);
	});
});

test('restaure la position enregistrée du joueur', async () => {
	await withMocks(
		async () => {
			const s = await setup();
			const player = players.get(s.id);

			assert.equal(player.x, 12);
			assert.equal(player.y, 6);
			assert.equal(player.z, -4);
			assert.equal(player.color, 12345);
		},
		{
			x: 12,
			y: 6,
			z: -4,
			color: 12345,
			skin: '#abcdef',
			build: 'slim',
		}
	);
});

test('utilise un avatar valide envoyé par le navigateur', async () => {
	await withMocks(async () => {
		const s = await setup({
			avatar: {
				skin: '#123ABC',
				build: 'large',
			},
		});

		assert.equal(players.get(s.id).skin, '#123ABC');
		assert.equal(players.get(s.id).build, 'large');
	});
});

test('ignore une couleur de peau invalide', async () => {
	await withMocks(async () => {
		const s = await setup({
			avatar: {
				skin: 'red',
				build: 'slim',
			},
		});

		assert.equal(players.get(s.id).skin, null);
		assert.equal(players.get(s.id).build, null);
	});
});

test('ignore une morphologie inconnue', async () => {
	await withMocks(async () => {
		const s = await setup({
			avatar: {
				skin: '#abcdef',
				build: 'giant',
			},
		});

		assert.equal(players.get(s.id).skin, null);
	});
});

test('envoie les événements init et currentPlayers', async () => {
	await withMocks(async () => {
		const s = await setup();

		assert.deepEqual(
			s.emitted.map((event) => event.event),
			['init', 'currentPlayers']
		);
		assert.equal(s.emitted[0].payload.playerId, s.id);
		assert.equal(s.emitted[1].payload.length, 1);
	});
});

test('annonce l’arrivée du joueur aux autres', async () => {
	await withMocks(async () => {
		const s = await setup();

		assert.equal(s.broadcast[0].event, 'playerJoined');
		assert.equal(s.broadcast[0].payload.id, s.id);
	});
});

test('enregistre les données d’un joueur connecté', async () => {
	await withMocks(async () => {
		await setup();

		assert.equal(service.savePlayer.mock.calls.length, 1);
		assert.equal(service.savePlayer.mock.calls[0].arguments[0], 10);
	});
});

test('ne sauvegarde pas les données d’un invité', async () => {
	await withMocks(async () => {
		const s = await setup({ user: null });

		assert.equal(players.get(s.id).userId, null);
		assert.equal(service.savePlayer.mock.calls.length, 0);
	});
});

test('met à jour la position lors d’un déplacement', async () => {
	await withMocks(async () => {
		const s = await setup();

		s.send('playerMove', {
			x: 8,
			y: 3,
			z: -2,
		});

		assert.equal(players.get(s.id).x, 8);
		assert.equal(players.get(s.id).y, 3);
		assert.equal(players.get(s.id).z, -2);

		assert.deepEqual(s.broadcast.at(-1), {
			event: 'playerMoved',
			payload: {
				id: s.id,
				x: 8,
				y: 3,
				z: -2,
			},
		});
	});
});

test('remplace les coordonnées invalides par zéro', async () => {
	await withMocks(async () => {
		const s = await setup();

		s.send('playerMove', {
			x: 'invalid',
			y: null,
			z: undefined,
		});

		assert.equal(players.get(s.id).x, 0);
		assert.equal(players.get(s.id).y, 0);
		assert.equal(players.get(s.id).z, 0);
	});
});

test('ignore les déplacements sans joueur enregistré', async () => {
	await withMocks(async () => {
		const s = await setup();
		players.delete(s.id);

		s.send('playerMove', { x: 10, y: 2, z: 3 });

		assert.equal(
			s.broadcast.filter((event) => event.event === 'playerMoved').length,
			0
		);
	});
});

test('retire le joueur lors de la déconnexion', async () => {
	await withMocks(async () => {
		const s = await setup();

		s.send('disconnect');

		assert.equal(players.has(s.id), false);
		assert.deepEqual(s.broadcast.at(-1), {
			event: 'playerLeft',
			payload: s.id,
		});
	});
});

test('ignore un déplacement null sans planter', async () => {
	await withMocks(async () => {
		const s = await setup();
		const before = { ...players.get(s.id) };

		assert.doesNotThrow(() => s.send('playerMove', null));

		assert.equal(players.get(s.id).x, before.x);
		assert.equal(players.get(s.id).y, before.y);
		assert.equal(players.get(s.id).z, before.z);
	});
});

test('ignore un déplacement transmis sous forme de tableau', async () => {
	await withMocks(async () => {
		const s = await setup();

		s.send('playerMove', [1, 2, 3]);

		assert.equal(players.get(s.id).x, 0);
		assert.equal(players.get(s.id).y, 5);
		assert.equal(players.get(s.id).z, 0);
	});
});
