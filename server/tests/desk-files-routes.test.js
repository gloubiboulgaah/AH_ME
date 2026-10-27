/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');

const auth = require('../src/modules/auth/service');
const files = require('../src/modules/desk-files/service');
const routes = require('../src/modules/desk-files/routes');

const user = { id: 10, username: 'Alice' };

const desk = {
	id: 3,
	server_id: 1,
	owner_id: 20,
};

const file = {
	id: 7,
	desk_id: 3,
	server_id: 1,
	owner_id: 20,
	uploader_id: 30,
	is_hidden: false,
	stored_name: 'test.pdf',
	original_name: 'rapport.pdf',
};

async function request(method, url, body) {
	const app = express();
	app.use(express.json());
	app.use(cookieParser());
	app.use('/desks', routes);

	app.use((err, req, res, next) => {
		res.status(err.status || 500).json({
			error: err.message,
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
		};
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
}

async function withMocks(callback, currentUser = user) {
	const handles = [];

	function stub(object, name, implementation) {
		const handle = mock.method(object, name, implementation);
		handles.push(handle);
		return handle;
	}

	stub(auth, 'getSessionUser', async () => currentUser);

	try {
		await callback(stub);
	} finally {
		for (const handle of handles.reverse()) {
			handle.mock.restore();
		}
	}
}

test('refuse de consulter les documents sans connexion', async () => {
	await withMocks(async () => {
		const result = await request('GET', '/desks/3/files');
		assert.equal(result.status, 401);
	}, null);
});

test('retourne 404 pour un bureau inexistant', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getDesk', async () => null);

		const result = await request('GET', '/desks/999/files');
		assert.equal(result.status, 404);
	});
});

test('interdit la liste des documents à un non-membre', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getDesk', async () => desk);
		stub(files, 'isServerMember', async () => false);

		const result = await request('GET', '/desks/3/files');
		assert.equal(result.status, 403);
	});
});

test('autorise un membre à consulter les documents visibles', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getDesk', async () => desk);
		stub(files, 'isServerMember', async () => true);

		const list = stub(files, 'listFiles', async () => [file]);

		const result = await request('GET', '/desks/3/files');

		assert.equal(result.status, 200);
		assert.deepEqual(result.body.files, [file]);
		assert.deepEqual(list.mock.calls[0].arguments, [3, 10, false]);
	});
});

test('autorise le propriétaire du bureau à consulter ses documents', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getDesk', async () => ({
			...desk,
			owner_id: 10,
		}));

		stub(files, 'isServerMember', async () => false);

		const list = stub(files, 'listFiles', async () => [file]);

		const result = await request('GET', '/desks/3/files');

		assert.equal(result.status, 200);
		assert.deepEqual(list.mock.calls[0].arguments, [3, 10, true]);
	});
});

test('retourne 404 pour un fichier appartenant à un autre bureau', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getFile', async () => ({
			...file,
			desk_id: 4,
		}));

		const result = await request('GET', '/desks/3/files/7');

		assert.equal(result.status, 404);
	});
});

test('interdit le téléchargement d’un fichier masqué à un tiers', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getFile', async () => ({
			...file,
			is_hidden: true,
		}));

		const result = await request('GET', '/desks/3/files/7');

		assert.equal(result.status, 403);
	});
});

test('interdit le téléchargement d’un fichier visible à un non-membre', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getFile', async () => file);
		stub(files, 'isServerMember', async () => false);

		const result = await request('GET', '/desks/3/files/7');

		assert.equal(result.status, 403);
	});
});

test('interdit de modifier la visibilité du document d’un autre', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getFile', async () => file);

		const update = stub(files, 'setFileHidden', async () => file);

		const result = await request('PATCH', '/desks/3/files/7/visibility', {
			isHidden: true,
		});

		assert.equal(result.status, 403);
		assert.equal(update.mock.calls.length, 0);
	});
});

test('refuse une valeur de visibilité qui n’est pas un booléen', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getFile', async () => ({
			...file,
			uploader_id: 10,
		}));

		const result = await request('PATCH', '/desks/3/files/7/visibility', {
			isHidden: 'true',
		});

		assert.equal(result.status, 400);
	});
});

test('autorise l’auteur du dépôt à masquer son document', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getFile', async () => ({
			...file,
			uploader_id: 10,
		}));

		const updated = { ...file, is_hidden: true };

		const update = stub(files, 'setFileHidden', async () => updated);

		const result = await request('PATCH', '/desks/3/files/7/visibility', {
			isHidden: true,
		});

		assert.equal(result.status, 200);
		assert.equal(result.body.ok, true);
		assert.equal(result.body.file.is_hidden, true);

		assert.deepEqual(update.mock.calls[0].arguments, [7, true]);
	});
});

test('autorise le propriétaire du bureau à changer la visibilité', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getFile', async () => ({
			...file,
			owner_id: 10,
		}));

		stub(files, 'setFileHidden', async () => ({
			...file,
			is_hidden: true,
		}));

		const result = await request('PATCH', '/desks/3/files/7/visibility', {
			isHidden: true,
		});

		assert.equal(result.status, 200);
	});
});

test('interdit de supprimer le document d’un autre utilisateur', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getFile', async () => file);

		const remove = stub(files, 'deleteFile', async () => file);

		const result = await request('DELETE', '/desks/3/files/7');

		assert.equal(result.status, 403);
		assert.equal(remove.mock.calls.length, 0);
	});
});

test('retourne 404 si le document à supprimer est introuvable', async () => {
	await withMocks(async (stub) => {
		stub(files, 'getFile', async () => null);

		const result = await request('DELETE', '/desks/3/files/999');

		assert.equal(result.status, 404);
	});
});
