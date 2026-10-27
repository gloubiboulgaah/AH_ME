/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const service = require('../src/modules/desk/service');
const { attach } = require('../src/modules/desk/socket');

async function setup(user = { id: 10 }) {
	const handlers = new Map();
	const emitted = [];
	const broadcast = [];
	const global = [];

	const socket = {
		data: { user, username: 'Alice' },
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

	const io = {
		emit(event, payload) {
			global.push({ event, payload });
		},
	};

	attach(io, socket);

	for (let i = 0; i < 20; i++) {
		if (emitted.some((item) => item.event === 'deskList')) break;
		await new Promise((resolve) => setImmediate(resolve));
	}

	return {
		socket,
		emitted,
		broadcast,
		global,
		async send(event, payload) {
			assert.ok(handlers.has(event));
			await handlers.get(event)(payload);
		},
	};
}

async function withMocks(callback, options = {}) {
	const handles = [];

	function stub(name, implementation) {
		const handle = mock.method(service, name, implementation);
		handles.push(handle);
		return handle;
	}

	stub(
		'assign',
		async () =>
			options.assignment ?? {
				deskId: 5,
				slotIndex: 2,
			}
	);

	stub('contentFor', async () => ({
		files: 2,
		notes: 3,
	}));

	stub('list', async () => [{ deskId: 5, slotIndex: 2, userId: 10 }]);

	stub('release', async () => ({
		deskId: 5,
		slotIndex: 2,
	}));

	try {
		await callback(stub);
	} finally {
		for (const handle of handles.reverse()) {
			handle.mock.restore();
		}
	}
}

test('attribue un bureau au joueur connecté', async () => {
	await withMocks(async () => {
		const s = await setup();

		assert.equal(s.socket.data.deskSlot, 2);
		assert.equal(s.broadcast[0].event, 'deskAssigned');
		assert.equal(s.broadcast[0].payload.deskId, 5);
		assert.equal(s.broadcast[0].payload.userId, 10);
		assert.deepEqual(s.broadcast[0].payload.content, {
			files: 2,
			notes: 3,
		});
	});
});

test('envoie la liste des bureaux au joueur', async () => {
	await withMocks(async () => {
		const s = await setup();
		const event = s.emitted.find((item) => item.event === 'deskList');

		assert.ok(event);
		assert.equal(event.payload.mySlotIndex, 2);
		assert.equal(event.payload.desks.length, 1);
	});
});

test('signale quand tous les bureaux sont occupés', async () => {
	await withMocks(
		async () => {
			const s = await setup();

			assert.ok(s.emitted.some((item) => item.event === 'deskFull'));
			assert.equal(s.broadcast.length, 0);
		},
		{ assignment: { reason: 'full' } }
	);
});

test('n’attribue aucun bureau à un invité', async () => {
	await withMocks(async (stub) => {
		const assign = service.assign;
		const s = await setup(null);

		assert.equal(assign.mock.calls.length, 0);
		assert.equal(s.broadcast.length, 0);

		const event = s.emitted.find((item) => item.event === 'deskList');
		assert.equal(event.payload.mySlotIndex, null);
	});
});

test('libère le bureau quand le joueur le quitte', async () => {
	await withMocks(async (stub) => {
		const release = service.release;
		const s = await setup();

		await s.send('deskLeave');

		assert.deepEqual(release.mock.calls[0].arguments, [10]);
		assert.equal(s.socket.data.deskSlot, null);
		assert.deepEqual(s.global.at(-1), {
			event: 'deskReleased',
			payload: { slotIndex: 2 },
		});
	});
});

test('ne libère pas de bureau pour un invité', async () => {
	await withMocks(async () => {
		const release = service.release;
		const s = await setup(null);

		await s.send('deskLeave');

		assert.equal(release.mock.calls.length, 0);
		assert.equal(s.global.length, 0);
	});
});

test('ne diffuse rien si aucun bureau n’est libéré', async () => {
	await withMocks(async (stub) => {
		stub('release', async () => null);
		const s = await setup();

		await s.send('deskLeave');

		assert.equal(s.global.length, 0);
	});
});

test('ignore une mise à jour de contenu sans données', async () => {
	await withMocks(async () => {
		const s = await setup();

		await s.send('deskContent', null);

		assert.equal(s.global.length, 0);
	});
});

test('ignore un identifiant de bureau non numérique', async () => {
	await withMocks(async () => {
		const s = await setup();

		await s.send('deskContent', {
			deskId: '5',
			slotIndex: 2,
		});

		assert.equal(s.global.length, 0);
	});
});

test('diffuse les nouveaux compteurs du bureau', async () => {
	await withMocks(async () => {
		const s = await setup();

		await s.send('deskContent', {
			deskId: 5,
			slotIndex: 2,
		});

		assert.deepEqual(s.global[0], {
			event: 'deskContent',
			payload: {
				slotIndex: 2,
				content: { files: 2, notes: 3 },
			},
		});
	});
});

test('refuse la mise à jour du bureau d’un autre utilisateur', async () => {
	await withMocks(async (stub) => {
		stub('list', async () => [{ deskId: 5, slotIndex: 2, userId: 99 }]);

		const s = await setup();

		await s.send('deskContent', {
			deskId: 5,
			slotIndex: 2,
		});

		assert.equal(s.global.length, 0);
	});
});

test('refuse une association bureau-emplacement falsifiée', async () => {
	await withMocks(async () => {
		const s = await setup();

		await s.send('deskContent', {
			deskId: 5,
			slotIndex: 9,
		});

		assert.equal(s.global.length, 0);
	});
});

test('refuse une mise à jour de contenu envoyée par un invité', async () => {
	await withMocks(async () => {
		const s = await setup(null);

		await s.send('deskContent', {
			deskId: 5,
			slotIndex: 2,
		});

		assert.equal(s.global.length, 0);
	});
});
