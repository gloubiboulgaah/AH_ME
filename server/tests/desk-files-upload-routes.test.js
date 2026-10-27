/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');

const auth = require('../src/modules/auth/service');
const files = require('../src/modules/desk-files/service');
const routes = require('../src/modules/desk-files/routes');

async function request(form) {
	const app = express();
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
		const response = await fetch(`http://127.0.0.1:${port}/desks/3/files`, {
			method: 'POST',
			headers: {
				Cookie: 'sid=test-session',
			},
			body: form,
		});

		return {
			status: response.status,
			body: await response.json(),
		};
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
}

async function withMocks(callback, user = { id: 10 }) {
	const handles = [];

	function stub(object, name, implementation) {
		const handle = mock.method(object, name, implementation);
		handles.push(handle);
		return handle;
	}

	stub(auth, 'getSessionUser', async () => user);

	try {
		await callback(stub);
	} finally {
		for (const handle of handles.reverse()) {
			handle.mock.restore();
		}
	}
}

function uploadForm(filename, content = 'test') {
	const form = new FormData();

	form.append(
		'file',
		new Blob([content], {
			type: 'application/octet-stream',
		}),
		filename
	);

	return form;
}

test('refuse un upload sans connexion', async () => {
	await withMocks(async () => {
		const result = await request(uploadForm('rapport.pdf'));

		assert.equal(result.status, 401);
	}, null);
});

test('refuse un upload sans fichier', async () => {
	await withMocks(async () => {
		const result = await request(new FormData());

		assert.equal(result.status, 400);
		assert.equal(result.body.error, 'fichier requis');
	});
});

test('refuse un fichier exécutable via HTTP', async () => {
	await withMocks(async (stub) => {
		const create = stub(files, 'createFile', async () => ({ id: 7 }));

		const result = await request(uploadForm('danger.exe'));

		assert.equal(result.status, 400);
		assert.equal(result.body.error, 'type de fichier interdit');
		assert.equal(create.mock.calls.length, 0);
	});
});

test('refuse une extension dangereuse en majuscules', async () => {
	await withMocks(async () => {
		const result = await request(uploadForm('script.SH'));

		assert.equal(result.status, 400);
		assert.equal(result.body.error, 'type de fichier interdit');
	});
});

test('refuse plusieurs fichiers dans un champ unique', async () => {
	await withMocks(async () => {
		const form = uploadForm('premier.pdf');

		form.append(
			'file',
			new Blob(['second'], { type: 'application/pdf' }),
			'second.pdf'
		);

		const result = await request(form);

		assert.equal(result.status, 400);
	});
});
