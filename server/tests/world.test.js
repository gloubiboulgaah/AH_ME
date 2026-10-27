/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/pool');
const world = require('../src/modules/world/service');

test('retourne null quand le joueur est introuvable', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [],
	}));

	try {
		const result = await world.loadPlayer(999);
		assert.equal(result, null);
		assert.deepEqual(query.mock.calls[0].arguments[1], [999]);
	} finally {
		query.mock.restore();
	}
});

test('charge les données enregistrées du joueur', async () => {
	const player = {
		user_id: 3,
		x: 10,
		y: 0,
		z: 5,
		color: '#ffffff',
	};

	const query = mock.method(db, 'query', async () => ({
		rows: [player],
	}));

	try {
		const result = await world.loadPlayer(3);
		assert.deepEqual(result, player);
	} finally {
		query.mock.restore();
	}
});
