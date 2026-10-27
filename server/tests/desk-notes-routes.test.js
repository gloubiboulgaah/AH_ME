/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const auth = require('../src/modules/auth/service');
const notes = require('../src/modules/desk-notes/service');
const routes = require('../src/modules/desk-notes/routes');

async function request(method, url, body) {
	const app = express();
	app.use(express.json());
	app.use('/desks', routes);
	app.use((err, req, res, next) => {
		res.status(err.status || 500).json({
			error: err.message,
		});
	});

	const server = app.listen(0);

	try {
		const address = server.address();
		const response = await fetch(`http://127.0.0.1:${address.port}${url}`, {
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
		};
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
}

function mocks(user = { id: 10 }) {
	const handles = [];

	function stub(object, name, implementation) {
		const handle = mock.method(object, name, implementation);
		handles.push(handle);
		return handle;
	}

	stub(auth, 'getSessionUser', async () => user);

	return {
		stub,
		restore() {
			for (const handle of handles.reverse()) {
				handle.mock.restore();
			}
		},
	};
}

test('refuse la lecture des post-its sans connexion', async () => {
	const m = mocks(null);

	try {
		const result = await request('GET', '/desks/3/notes');

		assert.equal(result.status, 401);
		assert.equal(result.body.error, 'authentification requise');
	} finally {
		m.restore();
	}
});

test('retourne 404 pour un bureau inexistant', async () => {
	const m = mocks();

	try {
		m.stub(notes, 'getDesk', async () => null);

		const result = await request('GET', '/desks/999/notes');

		assert.equal(result.status, 404);
	} finally {
		m.restore();
	}
});

test('interdit la lecture à un utilisateur extérieur au serveur', async () => {
	const m = mocks();

	try {
		m.stub(notes, 'getDesk', async () => ({
			id: 3,
			server_id: 1,
		}));
		m.stub(notes, 'isServerMember', async () => false);

		const result = await request('GET', '/desks/3/notes');

		assert.equal(result.status, 403);
	} finally {
		m.restore();
	}
});

test('autorise un membre à consulter les post-its', async () => {
	const m = mocks();
	const expected = [
		{
			id: 1,
			content: 'Bonjour',
			color: '#ffcc00',
		},
	];

	try {
		m.stub(notes, 'getDesk', async () => ({
			id: 3,
			server_id: 1,
		}));
		m.stub(notes, 'isServerMember', async () => true);
		m.stub(notes, 'listNotes', async () => expected);

		const result = await request('GET', '/desks/3/notes');

		assert.equal(result.status, 200);
		assert.deepEqual(result.body.files, undefined);
		assert.deepEqual(result.body.notes, expected);
	} finally {
		m.restore();
	}
});

test('interdit la création de post-it à un non-membre', async () => {
	const m = mocks();

	try {
		m.stub(notes, 'getDesk', async () => ({
			id: 3,
			server_id: 1,
		}));
		m.stub(notes, 'isServerMember', async () => false);

		const result = await request('POST', '/desks/3/notes', {
			content: 'Bonjour',
			color: '#ffffff',
		});

		assert.equal(result.status, 403);
	} finally {
		m.restore();
	}
});

test('crée un post-it pour un membre connecté', async () => {
	const m = mocks();
	const created = {
		id: 7,
		deskId: 3,
		content: 'Bonjour',
		color: '#abcdef',
	};

	try {
		m.stub(notes, 'getDesk', async () => ({
			id: 3,
			server_id: 1,
		}));
		m.stub(notes, 'isServerMember', async () => true);

		const create = m.stub(notes, 'createNote', async () => created);

		const result = await request('POST', '/desks/3/notes', {
			content: 'Bonjour',
			color: '#abcdef',
		});

		assert.equal(result.status, 201);
		assert.equal(result.body.ok, true);
		assert.deepEqual(result.body.note, created);
		assert.deepEqual(create.mock.calls[0].arguments[0], {
			deskId: 3,
			authorId: 10,
			content: 'Bonjour',
			color: '#abcdef',
		});
	} finally {
		m.restore();
	}
});

test('refuse de supprimer un post-it appartenant à un autre bureau', async () => {
	const m = mocks();

	try {
		m.stub(notes, 'getNote', async () => ({
			id: 8,
			desk_id: 4,
			author_id: 10,
			owner_id: 10,
		}));

		const result = await request('DELETE', '/desks/3/notes/8');

		assert.equal(result.status, 404);
	} finally {
		m.restore();
	}
});

test('refuse la suppression par un utilisateur non autorisé', async () => {
	const m = mocks();

	try {
		m.stub(notes, 'getNote', async () => ({
			id: 8,
			desk_id: 3,
			author_id: 20,
			owner_id: 30,
		}));

		const result = await request('DELETE', '/desks/3/notes/8');

		assert.equal(result.status, 403);
	} finally {
		m.restore();
	}
});

test('autorise un auteur à supprimer son post-it', async () => {
	const m = mocks();
	const note = {
		id: 8,
		desk_id: 3,
		author_id: 10,
		owner_id: 30,
	};

	try {
		m.stub(notes, 'getNote', async () => note);
		const remove = m.stub(notes, 'deleteNote', async () => note);

		const result = await request('DELETE', '/desks/3/notes/8');

		assert.equal(result.status, 200);
		assert.equal(result.body.ok, true);
		assert.deepEqual(remove.mock.calls[0].arguments, [8]);
	} finally {
		m.restore();
	}
});

test('autorise le propriétaire du bureau à supprimer un post-it', async () => {
	const m = mocks();

	try {
		m.stub(notes, 'getNote', async () => ({
			id: 8,
			desk_id: 3,
			author_id: 20,
			owner_id: 10,
		}));
		m.stub(notes, 'deleteNote', async () => ({
			id: 8,
		}));

		const result = await request('DELETE', '/desks/3/notes/8');

		assert.equal(result.status, 200);
	} finally {
		m.restore();
	}
});
