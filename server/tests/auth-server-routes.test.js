/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');

const authService = require('../src/modules/auth/service');
const serverService = require('../src/modules/server/service');
const deskService = require('../src/modules/desk/service');

const authRoutes = require('../src/modules/auth/routes');
const serverRoutes = require('../src/modules/server/routes');

async function request(method, url, body, options = {}) {
	const app = express();

	app.use(express.json());
	app.use(cookieParser());

	if (options.io) {
		app.set('io', options.io);
	}

	app.use('/auth', authRoutes);
	app.use('/servers', serverRoutes);

	app.use((err, req, res, next) => {
		res.status(err.status || 500).json({
			code: err.code || 'INTERNAL_ERROR',
			message: err.message,
		});
	});

	const server = app.listen(0);

	try {
		const { port } = server.address();

		const response = await fetch(`http://127.0.0.1:${port}${url}`, {
			method,
			headers: {
				'Content-Type': 'application/json',
				Cookie: 'sid=test-session',
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		return {
			status: response.status,
			body: await response.json(),
			cookie: response.headers.get('set-cookie'),
		};
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
}

async function withMocks(callback) {
	const handles = [];

	function stub(object, name, implementation) {
		const handle = mock.method(object, name, implementation);
		handles.push(handle);
		return handle;
	}

	try {
		await callback(stub);
	} finally {
		for (const handle of handles.reverse()) {
			handle.mock.restore();
		}
	}
}

const alice = {
	id: 10,
	username: 'Alice',
	email: 'alice@example.com',
};

const currentServer = {
	id: 3,
	name: 'AH_ME',
	owner_id: 10,
	capacity: 10,
	visibility: 'private',
	members: [
		{
			id: 10,
			username: 'Alice',
			role: 'owner',
			joined_at: '2026-10-25T10:00:00.000Z',
		},
	],
};

test('inscrit un utilisateur et crée une session', async () => {
	await withMocks(async (stub) => {
		const register = stub(authService, 'register', async () => alice);

		const createSession = stub(authService, 'createSession', async () => ({
			token: 'new-session',
		}));

		const result = await request('POST', '/auth/register', {
			username: 'Alice',
			email: 'alice@example.com',
			password: 'password123',
		});

		assert.equal(result.status, 201);
		assert.deepEqual(result.body.user, alice);
		assert.match(result.cookie, /sid=new-session/);
		assert.match(result.cookie, /HttpOnly/i);
		assert.match(result.cookie, /SameSite=Lax/i);

		assert.equal(register.mock.calls.length, 1);
		assert.deepEqual(createSession.mock.calls[0].arguments, [10]);
	});
});

test('connecte un utilisateur et crée une session', async () => {
	await withMocks(async (stub) => {
		const login = stub(authService, 'login', async () => alice);

		stub(authService, 'createSession', async () => ({
			token: 'login-session',
		}));

		const result = await request('POST', '/auth/login', {
			email: 'alice@example.com',
			password: 'password123',
		});

		assert.equal(result.status, 200);
		assert.deepEqual(result.body.user, alice);
		assert.match(result.cookie, /sid=login-session/);
		assert.equal(login.mock.calls.length, 1);
	});
});

test('renvoie une erreur quand la connexion échoue', async () => {
	await withMocks(async (stub) => {
		const error = new Error('identifiants incorrects');
		error.status = 401;
		error.code = 'INVALID_CREDENTIALS';

		stub(authService, 'login', async () => {
			throw error;
		});

		const result = await request('POST', '/auth/login', {
			email: 'alice@example.com',
			password: 'wrong',
		});

		assert.equal(result.status, 401);
		assert.equal(result.body.code, 'INVALID_CREDENTIALS');
	});
});

test('récupère le profil depuis le cookie de session', async () => {
	await withMocks(async (stub) => {
		const getUser = stub(authService, 'getSessionUser', async () => alice);

		const result = await request('GET', '/auth/me');

		assert.equal(result.status, 200);
		assert.deepEqual(result.body.user, alice);
		assert.deepEqual(getUser.mock.calls[0].arguments, ['test-session']);
	});
});

test('renvoie null quand la session est invalide', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => null);

		const result = await request('GET', '/auth/me');

		assert.equal(result.status, 200);
		assert.equal(result.body.user, null);
	});
});

test('déconnecte l’utilisateur et efface le cookie', async () => {
	await withMocks(async (stub) => {
		const deleteSession = stub(
			authService,
			'deleteSession',
			async () => {}
		);

		const result = await request('POST', '/auth/logout');

		assert.equal(result.status, 200);
		assert.deepEqual(result.body, { ok: true });
		assert.deepEqual(deleteSession.mock.calls[0].arguments, [
			'test-session',
		]);
		assert.match(result.cookie, /sid=/);
	});
});

test('refuse la consultation du serveur sans connexion', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => null);

		const result = await request('GET', '/servers/current');

		assert.equal(result.status, 401);
		assert.equal(result.body.code, 'AUTH_REQUIRED');
	});
});

test('retourne le serveur actif avec ses membres', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => alice);

		stub(serverService, 'getCurrentServer', async () => currentServer);

		const result = await request('GET', '/servers/current');

		assert.equal(result.status, 200);
		assert.equal(result.body.server.id, 3);
		assert.equal(result.body.server.ownerId, 10);
		assert.equal(result.body.server.members.length, 1);
		assert.equal(result.body.server.members[0].username, 'Alice');
	});
});

test('crée un serveur avec l’utilisateur connecté comme propriétaire', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => alice);

		const create = stub(serverService, 'createServer', async () => ({
			...currentServer,
			inviteCode: 'ABCD1234',
		}));

		const result = await request('POST', '/servers', {
			name: 'AH_ME',
			capacity: 10,
			visibility: 'private',
		});

		assert.equal(result.status, 201);
		assert.equal(result.body.inviteCode, 'ABCD1234');
		assert.equal(result.body.server.ownerId, 10);

		assert.deepEqual(create.mock.calls[0].arguments[0], {
			name: 'AH_ME',
			capacity: 10,
			visibility: 'private',
			ownerId: 10,
		});
	});
});

test('refuse un identifiant de serveur invalide', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => alice);

		const remove = stub(serverService, 'deleteServer', async () => {});

		const result = await request('DELETE', '/servers/invalide');

		assert.equal(result.status, 400);
		assert.equal(result.body.code, 'INVALID_SERVER_ID');
		assert.equal(remove.mock.calls.length, 0);
	});
});

test('transmet le code d’invitation lors de l’adhésion', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => alice);

		const join = stub(serverService, 'joinServer', async () => ({
			alreadyMember: false,
			server: currentServer,
		}));

		const result = await request('POST', '/servers/3/join', {
			inviteCode: 'ABCD1234',
		});

		assert.equal(result.status, 200);
		assert.equal(result.body.code, 'SERVER_JOINED');

		assert.deepEqual(join.mock.calls[0].arguments, [3, 10, 'ABCD1234']);
	});
});

test('signale un membre déjà inscrit au serveur', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => alice);

		stub(serverService, 'joinServer', async () => ({
			alreadyMember: true,
			server: currentServer,
		}));

		const result = await request('POST', '/servers/3/join');

		assert.equal(result.status, 200);
		assert.equal(result.body.code, 'ALREADY_MEMBER');
	});
});

test('libère le bureau quand un membre quitte le serveur', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => alice);

		const leave = stub(serverService, 'leaveServer', async () => {});

		const release = stub(deskService, 'release', async () => ({
			deskId: 20,
			slotIndex: 4,
		}));

		const events = [];

		const io = {
			emit(event, payload) {
				events.push({ event, payload });
			},
		};

		const result = await request('POST', '/servers/3/leave', undefined, {
			io,
		});

		assert.equal(result.status, 200);
		assert.equal(result.body.releasedSlotIndex, 4);

		assert.deepEqual(leave.mock.calls[0].arguments, [3, 10]);

		assert.deepEqual(release.mock.calls[0].arguments, [10]);

		assert.deepEqual(events, [
			{
				event: 'deskReleased',
				payload: { slotIndex: 4 },
			},
		]);
	});
});

test('régénère un code d’invitation', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => alice);

		const regenerate = stub(
			serverService,
			'regenerateInviteCode',
			async () => 'NEWCODE1'
		);

		const result = await request('POST', '/servers/3/invite/regenerate');

		assert.equal(result.status, 200);
		assert.equal(result.body.inviteCode, 'NEWCODE1');

		assert.deepEqual(regenerate.mock.calls[0].arguments, [3, 10]);
	});
});

test('exclut un membre et déconnecte sa socket', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => alice);

		const remove = stub(serverService, 'removeMember', async () => {});

		stub(deskService, 'release', async () => ({
			deskId: 20,
			slotIndex: 2,
		}));

		const events = [];
		let disconnected = false;

		const targetSocket = {
			data: { user: { id: 25 } },
			emit(event) {
				events.push(event);
			},
			disconnect(force) {
				disconnected = force;
			},
		};

		const io = {
			emit(event) {
				events.push(event);
			},
			async fetchSockets() {
				return [targetSocket];
			},
		};

		const result = await request(
			'DELETE',
			'/servers/3/members/25',
			undefined,
			{ io }
		);

		assert.equal(result.status, 200);
		assert.deepEqual(result.body, { ok: true });

		assert.deepEqual(remove.mock.calls[0].arguments, [3, 10, 25]);

		assert.ok(events.includes('deskReleased'));
		assert.ok(events.includes('serverKicked'));
		assert.equal(disconnected, true);
	});
});

test('refuse une exclusion avec un identifiant invalide', async () => {
	await withMocks(async (stub) => {
		stub(authService, 'getSessionUser', async () => alice);

		const remove = stub(serverService, 'removeMember', async () => {});

		const result = await request('DELETE', '/servers/3/members/abc');

		assert.equal(result.status, 400);
		assert.equal(result.body.code, 'INVALID_ID');
		assert.equal(remove.mock.calls.length, 0);
	});
});
