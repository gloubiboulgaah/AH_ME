/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/pool');
const config = require('../src/config');
const service = require('../src/modules/desk-files/service');

test('autorise un upload si le bureau a encore de la place', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [{ count: 2 }],
	}));

	try {
		assert.equal(await service.canUploadToDesk(1), true);
		assert.deepEqual(query.mock.calls[0].arguments[1], [1]);
	} finally {
		query.mock.restore();
	}
});

test('refuse un upload quand la limite est atteinte', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [{ count: config.maxFilesPerDesk }],
	}));

	try {
		assert.equal(await service.canUploadToDesk(1), false);
	} finally {
		query.mock.restore();
	}
});

test('enregistre les métadonnées du fichier', async () => {
	const file = {
		id: 8,
		desk_id: 1,
		uploader_id: 2,
		original_name: 'rapport.pdf',
		is_hidden: false,
	};

	const query = mock.method(db, 'query', async () => ({
		rows: [file],
	}));

	try {
		const result = await service.createFile({
			deskId: 1,
			uploaderId: 2,
			originalName: 'rapport.pdf',
			storedName: 'random-file.pdf',
			size: 2048,
			mimeType: 'application/pdf',
		});

		assert.deepEqual(result, file);
		assert.deepEqual(query.mock.calls[0].arguments[1], [
			1,
			2,
			'rapport.pdf',
			'random-file.pdf',
			2048,
			'application/pdf',
		]);
	} finally {
		query.mock.restore();
	}
});

test('filtre les documents masqués selon les droits', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [],
	}));

	try {
		await service.listFiles(1, 2, false);

		assert.match(query.mock.calls[0].arguments[0], /f\.is_hidden = false/);

		assert.match(query.mock.calls[0].arguments[0], /f\.uploader_id = \$3/);

		assert.deepEqual(query.mock.calls[0].arguments[1], [1, false, 2]);
	} finally {
		query.mock.restore();
	}
});

test('permet de masquer un document', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [{ id: 5, is_hidden: true }],
	}));

	try {
		const result = await service.setFileHidden(5, true);

		assert.equal(result.is_hidden, true);
		assert.deepEqual(query.mock.calls[0].arguments[1], [5, true]);
	} finally {
		query.mock.restore();
	}
});

test('retourne null quand le fichier à supprimer est introuvable', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [],
	}));

	try {
		const result = await service.deleteFile(999);
		assert.equal(result, null);
	} finally {
		query.mock.restore();
	}
});
