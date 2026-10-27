/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const db = require('../src/db/pool');
const auth = require('../src/modules/auth/service');

test('refuse un pseudo trop court', async () => {
	await assert.rejects(
		auth.register({
			username: 'ab',
			email: 'test@example.com',
			password: 'password123',
		}),
		{ status: 400 }
	);
});

test('refuse un pseudo contenant des caractères interdits', async () => {
	await assert.rejects(
		auth.register({
			username: 'nom invalide!',
			email: 'test@example.com',
			password: 'password123',
		}),
		{ status: 400 }
	);
});

test('refuse une adresse email sans arobase', async () => {
	await assert.rejects(
		auth.register({
			username: 'Alice',
			email: 'invalide',
			password: 'password123',
		}),
		{ status: 400 }
	);
});

test('refuse un mot de passe trop court', async () => {
	await assert.rejects(
		auth.register({
			username: 'Alice',
			email: 'alice@example.com',
			password: '1234567',
		}),
		{ status: 400 }
	);
});

test('enregistre un utilisateur avec un mot de passe haché', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [
			{
				id: 1,
				username: 'Alice',
				email: 'alice@example.com',
			},
		],
	}));

	try {
		const user = await auth.register({
			username: 'Alice',
			email: 'ALICE@EXAMPLE.COM',
			password: 'password123',
		});

		assert.equal(user.username, 'Alice');

		const params = query.mock.calls[0].arguments[1];
		assert.equal(params[1], 'alice@example.com');
		assert.notEqual(params[2], 'password123');
		assert.equal(await bcrypt.compare('password123', params[2]), true);
	} finally {
		query.mock.restore();
	}
});

test('refuse un email ou pseudo déjà utilisé', async () => {
	const query = mock.method(db, 'query', async () => {
		const error = new Error('duplicate');
		error.code = '23505';
		throw error;
	});

	try {
		await assert.rejects(
			auth.register({
				username: 'Alice',
				email: 'alice@example.com',
				password: 'password123',
			}),
			{ status: 409 }
		);
	} finally {
		query.mock.restore();
	}
});

test('refuse une connexion si le compte est inexistant', async () => {
	const query = mock.method(db, 'query', async () => ({ rows: [] }));

	try {
		await assert.rejects(
			auth.login({
				email: 'unknown@example.com',
				password: 'password123',
			}),
			{ status: 401 }
		);
	} finally {
		query.mock.restore();
	}
});

test('refuse un mot de passe incorrect', async () => {
	const passwordHash = await bcrypt.hash('correct-password', 4);
	const query = mock.method(db, 'query', async () => ({
		rows: [
			{
				id: 1,
				username: 'Alice',
				email: 'alice@example.com',
				password_hash: passwordHash,
			},
		],
	}));

	try {
		await assert.rejects(
			auth.login({
				email: 'alice@example.com',
				password: 'wrong-password',
			}),
			{ status: 401 }
		);
	} finally {
		query.mock.restore();
	}
});

test('connecte un utilisateur avec des identifiants valides', async () => {
	const passwordHash = await bcrypt.hash('correct-password', 4);
	const query = mock.method(db, 'query', async () => ({
		rows: [
			{
				id: 7,
				username: 'Alice',
				email: 'alice@example.com',
				password_hash: passwordHash,
			},
		],
	}));

	try {
		const user = await auth.login({
			email: 'ALICE@EXAMPLE.COM',
			password: 'correct-password',
		});

		assert.deepEqual(user, {
			id: 7,
			username: 'Alice',
			email: 'alice@example.com',
		});
	} finally {
		query.mock.restore();
	}
});

test('retourne null sans token de session', async () => {
	assert.equal(await auth.getSessionUser(null), null);
});

test('retourne null pour une session expirée ou inconnue', async () => {
	const query = mock.method(db, 'query', async () => ({ rows: [] }));

	try {
		assert.equal(await auth.getSessionUser('expired-token'), null);
	} finally {
		query.mock.restore();
	}
});

test('retrouve un utilisateur avec une session valide', async () => {
	const expected = {
		id: 4,
		username: 'Bob',
		email: 'bob@example.com',
	};

	const query = mock.method(db, 'query', async () => ({
		rows: [expected],
	}));

	try {
		const result = await auth.getSessionUser('valid-token');
		assert.deepEqual(result, expected);
		assert.deepEqual(query.mock.calls[0].arguments[1], ['valid-token']);
	} finally {
		query.mock.restore();
	}
});

test('supprime une session lors de la déconnexion', async () => {
	const query = mock.method(db, 'query', async () => ({ rows: [] }));

	try {
		await auth.deleteSession('token-to-delete');

		assert.match(query.mock.calls[0].arguments[0], /DELETE FROM sessions/);
		assert.deepEqual(query.mock.calls[0].arguments[1], ['token-to-delete']);
	} finally {
		query.mock.restore();
	}
});

test('ne fait aucune requête pour supprimer une session absente', async () => {
	const query = mock.method(db, 'query', async () => ({ rows: [] }));

	try {
		await auth.deleteSession(null);
		assert.equal(query.mock.calls.length, 0);
	} finally {
		query.mock.restore();
	}
});
