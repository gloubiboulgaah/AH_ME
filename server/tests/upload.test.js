/** @format */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const upload = require('../src/modules/desk-files/upload');
const config = require('../src/config');

function checkFile(filename) {
	return new Promise((resolve) => {
		upload.fileFilter({}, { originalname: filename }, (error, accepted) =>
			resolve({ error, accepted })
		);
	});
}

test('accepte un fichier PDF', async () => {
	const result = await checkFile('rapport.pdf');
	assert.equal(result.error, null);
	assert.equal(result.accepted, true);
});

test('accepte un document Word', async () => {
	const result = await checkFile('compte-rendu.docx');
	assert.equal(result.error, null);
	assert.equal(result.accepted, true);
});

test('accepte une image PNG', async () => {
	const result = await checkFile('capture.png');
	assert.equal(result.error, null);
	assert.equal(result.accepted, true);
});

test('refuse les extensions exécutables', async () => {
	for (const filename of [
		'virus.exe',
		'install.msi',
		'script.bat',
		'command.cmd',
		'script.sh',
		'program.jar',
		'installer.dmg',
	]) {
		const result = await checkFile(filename);

		assert.ok(result.error instanceof Error, filename);
		assert.equal(result.error.message, 'type de fichier interdit');
	}
});

test('refuse les extensions dangereuses indépendamment de la casse', async () => {
	const result = await checkFile('PROGRAM.EXE');

	assert.ok(result.error instanceof Error);
	assert.equal(result.accepted, undefined);
});

test('applique la limite de taille configurée', () => {
	assert.equal(upload.limits.fileSize, config.maxFileSize);
	assert.equal(config.maxFileSize, 10 * 1024 * 1024);
});

test('génère un nom de stockage différent du nom original', async () => {
	const filename = await new Promise((resolve, reject) => {
		upload.storage.getFilename(
			{},
			{ originalname: 'rapport.pdf' },
			(error, name) => {
				if (error) reject(error);
				else resolve(name);
			}
		);
	});

	assert.match(
		filename,
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/
	);

	assert.notEqual(filename, 'rapport.pdf');
});

test('génère deux noms différents pour deux uploads', async () => {
	async function filename() {
		return new Promise((resolve, reject) => {
			upload.storage.getFilename(
				{},
				{ originalname: 'rapport.pdf' },
				(error, name) => (error ? reject(error) : resolve(name))
			);
		});
	}

	const first = await filename();
	const second = await filename();

	assert.notEqual(first, second);
});
