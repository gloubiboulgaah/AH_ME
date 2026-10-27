/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../src/db/pool');
const service = require('../src/modules/server/service');

const publicServer = {
	id: 1,
	name: 'AH_ME',
	owner_id: 10,
	capacity: 5,
	visibility: 'public',
	invite_code_hash: null,
};

function fakeTransaction(responses) {
	const queries = [];
	let index = 0;
	let released = false;

	const client = {
		async query(sql, params) {
			queries.push({ sql, params });

			if (/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(sql)) {
				return { rows: [], rowCount: 0 };
			}

			const response = responses[index++];
			if (response instanceof Error) throw response;
			if (!response) throw new Error('Unexpected database query');

			return response;
		},
		release() {
			released = true;
		},
	};

	return {
		client,
		queries,
		get released() {
			return released;
		},
	};
}

function withTransaction(responses, callback) {
	const transaction = fakeTransaction(responses);
	const connect = mock.method(
		db.pool,
		'connect',
		async () => transaction.client
	);

	return Promise.resolve()
		.then(() => callback(transaction))
		.finally(() => connect.mock.restore());
}

test('refuse de rejoindre un serveur inexistant', async () => {
	await withTransaction([{ rows: [] }], async (tx) => {
		await assert.rejects(service.joinServer(999, 20), {
			status: 404,
			code: 'SERVER_NOT_FOUND',
		});

		assert.equal(tx.released, true);
		assert.ok(tx.queries.some((q) => q.sql === 'ROLLBACK'));
	});
});

test('un membre déjà inscrit peut rejoindre à nouveau sans doublon', async () => {
	await withTransaction(
		[{ rows: [publicServer] }, { rows: [{ '?column?': 1 }], rowCount: 1 }],
		async (tx) => {
			const result = await service.joinServer(1, 20);

			assert.equal(result.alreadyMember, true);
			assert.equal(result.server.id, 1);
			assert.ok(tx.queries.some((q) => q.sql === 'COMMIT'));
			assert.equal(
				tx.queries.some((q) =>
					/INSERT INTO server_members/.test(q.sql)
				),
				false
			);
		}
	);
});

test('un utilisateur peut rejoindre un serveur public', async () => {
	await withTransaction(
		[
			{ rows: [publicServer] },
			{ rows: [], rowCount: 0 },
			{ rows: [{ count: 2 }] },
			{ rows: [], rowCount: 1 },
		],
		async (tx) => {
			const result = await service.joinServer(1, 20);

			assert.equal(result.alreadyMember, false);

			const insert = tx.queries.find((q) =>
				/INSERT INTO server_members/.test(q.sql)
			);

			assert.deepEqual(insert.params, [1, 20]);
			assert.ok(tx.queries.some((q) => q.sql === 'COMMIT'));
		}
	);
});

test('refuse de rejoindre un serveur complet', async () => {
	await withTransaction(
		[
			{ rows: [publicServer] },
			{ rows: [], rowCount: 0 },
			{ rows: [{ count: 5 }] },
		],
		async (tx) => {
			await assert.rejects(service.joinServer(1, 20), {
				status: 409,
				code: 'SERVER_FULL',
			});

			assert.ok(tx.queries.some((q) => q.sql === 'ROLLBACK'));
		}
	);
});

test('un serveur privé exige un code d’invitation', async () => {
	await withTransaction(
		[
			{ rows: [{ ...publicServer, visibility: 'private' }] },
			{ rows: [], rowCount: 0 },
		],
		async () => {
			await assert.rejects(service.joinServer(1, 20), {
				status: 403,
				code: 'INVITE_CODE_REQUIRED',
			});
		}
	);
});

test('refuse un code d’invitation incorrect', async () => {
	const hash = crypto.createHash('sha256').update('ABCDEFGH').digest('hex');

	await withTransaction(
		[
			{
				rows: [
					{
						...publicServer,
						visibility: 'private',
						invite_code_hash: hash,
					},
				],
			},
			{ rows: [], rowCount: 0 },
		],
		async () => {
			await assert.rejects(service.joinServer(1, 20, 'BADCODE1'), {
				status: 403,
				code: 'INVALID_INVITE_CODE',
			});
		}
	);
});

test('accepte un code privé valide même saisi en minuscules', async () => {
	const hash = crypto.createHash('sha256').update('ABCDEFGH').digest('hex');

	await withTransaction(
		[
			{
				rows: [
					{
						...publicServer,
						visibility: 'private',
						invite_code_hash: hash,
					},
				],
			},
			{ rows: [], rowCount: 0 },
			{ rows: [{ count: 1 }] },
			{ rows: [], rowCount: 1 },
		],
		async () => {
			const result = await service.joinServer(1, 20, 'abcdefgh');
			assert.equal(result.alreadyMember, false);
		}
	);
});

test('un propriétaire peut créer un serveur privé avec code haché', async () => {
	const created = {
		id: 3,
		name: 'Salon privé',
		owner_id: 10,
		capacity: 8,
		visibility: 'private',
	};

	await withTransaction(
		[{ rows: [created] }, { rows: [], rowCount: 1 }],
		async (tx) => {
			const result = await service.createServer({
				name: 'Salon privé',
				capacity: 8,
				visibility: 'private',
				ownerId: 10,
			});

			assert.match(result.inviteCode, /^[A-F0-9]{8}$/);

			const insert = tx.queries.find((q) =>
				/INSERT INTO servers/.test(q.sql)
			);

			assert.notEqual(insert.params[2], result.inviteCode);
			assert.equal(
				insert.params[2],
				crypto
					.createHash('sha256')
					.update(result.inviteCode)
					.digest('hex')
			);

			assert.ok(
				tx.queries.some((q) => /INSERT INTO server_members/.test(q.sql))
			);
		}
	);
});

test('refuse un deuxième serveur actif', async () => {
	const duplicate = new Error('duplicate key');
	duplicate.code = '23505';

	await withTransaction([duplicate], async (tx) => {
		await assert.rejects(
			service.createServer({
				name: 'Second salon',
				capacity: 10,
				ownerId: 10,
			}),
			{ status: 409, code: 'SERVER_ALREADY_EXISTS' }
		);

		assert.ok(tx.queries.some((q) => q.sql === 'ROLLBACK'));
	});
});

test('régénère un code privé et stocke uniquement son hash', async () => {
	const query = mock.method(db, 'query', async (sql) => {
		if (/SELECT/.test(sql)) {
			return {
				rows: [
					{
						id: 1,
						owner_id: 10,
						visibility: 'private',
					},
				],
			};
		}
		return { rows: [], rowCount: 1 };
	});

	try {
		const code = await service.regenerateInviteCode(1, 10);

		assert.match(code, /^[A-F0-9]{8}$/);

		const update = query.mock.calls[1].arguments;
		const expectedHash = crypto
			.createHash('sha256')
			.update(code)
			.digest('hex');

		assert.deepEqual(update[1], [expectedHash, 1]);
	} finally {
		query.mock.restore();
	}
});

test('un membre peut quitter le serveur', async () => {
	const query = mock.method(db, 'query', async (sql) => {
		if (/SELECT/.test(sql)) {
			return { rows: [{ id: 1, owner_id: 10 }] };
		}
		return { rowCount: 1, rows: [] };
	});

	try {
		await service.leaveServer(1, 20);

		assert.match(
			query.mock.calls[1].arguments[0],
			/DELETE FROM server_members/
		);
		assert.deepEqual(query.mock.calls[1].arguments[1], [1, 20]);
	} finally {
		query.mock.restore();
	}
});

test('refuse le départ d’un utilisateur non membre', async () => {
	const query = mock.method(db, 'query', async (sql) => {
		if (/SELECT/.test(sql)) {
			return { rows: [{ id: 1, owner_id: 10 }] };
		}
		return { rowCount: 0, rows: [] };
	});

	try {
		await assert.rejects(service.leaveServer(1, 20), {
			status: 404,
			code: 'NOT_A_MEMBER',
		});
	} finally {
		query.mock.restore();
	}
});
