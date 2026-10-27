/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/pool');
const desk = require('../src/modules/desk/service');

async function withQueries(responses, callback) {
	const query = mock.method(db, 'query', async () => {
		if (responses.length === 0) {
			throw new Error('Requête SQL inattendue');
		}
		return responses.shift();
	});

	try {
		await callback(query);
		assert.equal(
			responses.length,
			0,
			'Certaines réponses SQL simulées n’ont pas été utilisées'
		);
	} finally {
		query.mock.restore();
	}
}

test('prévoit 10 emplacements de bureaux', () => {
	assert.equal(desk.SLOT_COUNT, 10);
});

test('retourne une liste vide sans serveur actif', async () => {
	await withQueries([{ rows: [] }], async (query) => {
		assert.deepEqual(await desk.list(), []);
		assert.equal(query.mock.calls.length, 1);
	});
});

test('liste les bureaux et leurs compteurs', async () => {
	await withQueries(
		[
			{ rows: [{ id: 3 }] },
			{ rows: [] },
			{
				rows: [
					{
						id: 10,
						slot_index: 0,
						owner_id: 5,
						username: 'Alice',
						files: 2,
						notes: 3,
					},
					{
						id: 11,
						slot_index: 1,
						owner_id: null,
						username: null,
						files: 0,
						notes: 0,
					},
				],
			},
		],
		async (query) => {
			assert.deepEqual(await desk.list(), [
				{
					deskId: 10,
					slotIndex: 0,
					userId: 5,
					username: 'Alice',
					content: { files: 2, notes: 3 },
				},
				{
					deskId: 11,
					slotIndex: 1,
					userId: null,
					username: null,
					content: { files: 0, notes: 0 },
				},
			]);

			assert.deepEqual(query.mock.calls[1].arguments[1], [3, 9]);
		}
	);
});

test('retourne les compteurs d’un bureau', async () => {
	await withQueries([{ rows: [{ files: 4, notes: 7 }] }], async () => {
		assert.deepEqual(await desk.contentFor(12), {
			files: 4,
			notes: 7,
		});
	});
});

test('retourne des compteurs à zéro sans résultat', async () => {
	await withQueries([{ rows: [] }], async () => {
		assert.deepEqual(await desk.contentFor(12), {
			files: 0,
			notes: 0,
		});
	});
});

test('ne peut pas attribuer de bureau sans serveur', async () => {
	await withQueries([{ rows: [] }], async () => {
		assert.deepEqual(await desk.assign(5), {
			reason: 'no-server',
		});
	});
});

test('refuse un bureau à un utilisateur non membre', async () => {
	await withQueries([{ rows: [{ id: 3 }] }, { rows: [] }], async (query) => {
		assert.deepEqual(await desk.assign(5), {
			reason: 'not-member',
		});

		assert.equal(query.mock.calls.length, 2);
	});
});

test('réutilise le bureau déjà attribué à un membre', async () => {
	await withQueries(
		[
			{ rows: [{ id: 3 }] },
			{ rows: [{ '?column?': 1 }] },
			{ rows: [] },
			{ rows: [{ id: 15, slot_index: 4 }] },
		],
		async (query) => {
			assert.deepEqual(await desk.assign(5), {
				deskId: 15,
				slotIndex: 4,
				reused: true,
			});

			assert.equal(query.mock.calls.length, 4);
		}
	);
});

test('attribue le premier bureau disponible', async () => {
	await withQueries(
		[
			{ rows: [{ id: 3 }] },
			{ rows: [{ '?column?': 1 }] },
			{ rows: [] },
			{ rows: [] },
			{ rows: [{ id: 16, slot_index: 2 }] },
		],
		async (query) => {
			assert.deepEqual(await desk.assign(5), {
				deskId: 16,
				slotIndex: 2,
				reused: false,
			});

			const update = query.mock.calls[4].arguments;
			assert.match(update[0], /owner_id IS NULL/);
			assert.deepEqual(update[1], [3, 5]);
		}
	);
});

test('signale que tous les bureaux sont occupés', async () => {
	await withQueries(
		[
			{ rows: [{ id: 3 }] },
			{ rows: [{ '?column?': 1 }] },
			{ rows: [] },
			{ rows: [] },
			{ rows: [] },
		],
		async () => {
			assert.deepEqual(await desk.assign(5), {
				reason: 'full',
			});
		}
	);
});

test('ne libère rien sans serveur actif', async () => {
	await withQueries([{ rows: [] }], async () => {
		assert.equal(await desk.release(5), null);
	});
});

test('ne libère rien si le membre ne possède pas de bureau', async () => {
	await withQueries([{ rows: [{ id: 3 }] }, { rows: [] }], async () => {
		assert.equal(await desk.release(5), null);
	});
});

test('libère un bureau et supprime ses fichiers et post-its', async () => {
	await withQueries(
		[
			{ rows: [{ id: 3 }] },
			{ rows: [{ id: 16, slot_index: 2 }] },
			{ rows: [], rowCount: 2 },
			{ rows: [], rowCount: 3 },
			{ rows: [], rowCount: 1 },
		],
		async (query) => {
			assert.deepEqual(await desk.release(5), {
				deskId: 16,
				slotIndex: 2,
			});

			assert.match(
				query.mock.calls[2].arguments[0],
				/DELETE FROM desk_files/
			);

			assert.match(
				query.mock.calls[3].arguments[0],
				/DELETE FROM desk_notes/
			);

			assert.match(query.mock.calls[4].arguments[0], /owner_id = NULL/);

			assert.deepEqual(query.mock.calls[4].arguments[1], [16]);
		}
	);
});
