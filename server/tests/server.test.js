/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/pool');
const service = require('../src/modules/server/service');

test('refuse un nom de serveur vide', async () => {
	await assert.rejects(
		service.createServer({
			name: ' ',
			capacity: 10,
			ownerId: 1,
		}),
		{ status: 400, code: 'INVALID_SERVER_NAME' }
	);
});

test('refuse un nom de plus de 128 caractères', async () => {
	await assert.rejects(
		service.createServer({
			name: 'a'.repeat(129),
			capacity: 10,
			ownerId: 1,
		}),
		{ status: 400, code: 'INVALID_SERVER_NAME' }
	);
});

test('refuse une capacité inférieure à 2', async () => {
	await assert.rejects(
		service.createServer({
			name: 'Mon salon',
			capacity: 1,
			ownerId: 1,
		}),
		{ status: 400, code: 'INVALID_CAPACITY' }
	);
});

test('refuse une capacité supérieure à 50', async () => {
	await assert.rejects(
		service.createServer({
			name: 'Mon salon',
			capacity: 51,
			ownerId: 1,
		}),
		{ status: 400, code: 'INVALID_CAPACITY' }
	);
});

test('refuse une capacité non entière', async () => {
	await assert.rejects(
		service.createServer({
			name: 'Mon salon',
			capacity: 4.5,
			ownerId: 1,
		}),
		{ status: 400, code: 'INVALID_CAPACITY' }
	);
});

test('retourne null quand aucun serveur actif n’existe', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [],
	}));

	try {
		const result = await service.getCurrentServer();
		assert.equal(result, null);
	} finally {
		query.mock.restore();
	}
});

test('refuse la suppression par un utilisateur non propriétaire', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [{ id: 1, owner_id: 10 }],
	}));

	try {
		await assert.rejects(service.deleteServer(1, 20), {
			status: 403,
			code: 'SERVER_OWNER_REQUIRED',
		});
	} finally {
		query.mock.restore();
	}
});

test('refuse la suppression d’un serveur inexistant', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [],
	}));

	try {
		await assert.rejects(service.deleteServer(999, 1), {
			status: 404,
			code: 'SERVER_NOT_FOUND',
		});
	} finally {
		query.mock.restore();
	}
});

test('empêche le propriétaire de quitter son serveur', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [{ id: 1, owner_id: 5 }],
	}));

	try {
		await assert.rejects(service.leaveServer(1, 5), {
			status: 400,
			code: 'OWNER_CANNOT_LEAVE',
		});
	} finally {
		query.mock.restore();
	}
});

test('refuse la régénération du code par un non-propriétaire', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [{ id: 1, owner_id: 5, visibility: 'private' }],
	}));

	try {
		await assert.rejects(service.regenerateInviteCode(1, 9), {
			status: 403,
			code: 'SERVER_OWNER_REQUIRED',
		});
	} finally {
		query.mock.restore();
	}
});

test('refuse de régénérer un code pour un serveur public', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [{ id: 1, owner_id: 5, visibility: 'public' }],
	}));

	try {
		await assert.rejects(service.regenerateInviteCode(1, 5), {
			status: 400,
			code: 'SERVER_NOT_PRIVATE',
		});
	} finally {
		query.mock.restore();
	}
});

test('empêche le propriétaire de s’exclure lui-même', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [{ id: 1, owner_id: 5 }],
	}));

	try {
		await assert.rejects(service.removeMember(1, 5, 5), {
			status: 400,
			code: 'OWNER_CANNOT_BE_REMOVED',
		});
	} finally {
		query.mock.restore();
	}
});
