/** @format */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/pool');

const service = require('../src/modules/desk-notes/service');

test('refuse un post-it vide', async () => {
	await assert.rejects(
		service.createNote({
			deskId: 1,
			authorId: 2,
			content: '   ',
			color: '#fff3a3',
		}),
		{ status: 400, message: 'texte requis' }
	);
});

test('refuse un post-it de plus de 500 caractères', async () => {
	await assert.rejects(
		service.createNote({
			deskId: 1,
			authorId: 2,
			content: 'a'.repeat(501),
			color: '#fff3a3',
		}),
		{ status: 400 }
	);
});

test('refuse une couleur invalide', async () => {
	for (const color of ['red', '#123', '#12345678', 'javascript:alert(1)']) {
		await assert.rejects(
			service.createNote({
				deskId: 1,
				authorId: 2,
				content: 'Bonjour',
				color,
			}),
			{ status: 400, message: 'couleur invalide' }
		);
	}
});

test('accepte une couleur personnalisée et retourne son auteur', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [
			{
				id: 10,
				deskId: 1,
				authorId: 2,
				authorUsername: 'Alice',
				content: 'Bonjour',
				color: '#a1b2c3',
			},
		],
	}));

	try {
		const note = await service.createNote({
			deskId: 1,
			authorId: 2,
			content: '  Bonjour  ',
			color: '#a1b2c3',
		});

		assert.equal(note.color, '#a1b2c3');
		assert.equal(note.authorUsername, 'Alice');
		assert.equal(query.mock.calls.length, 1);
		assert.deepEqual(query.mock.calls[0].arguments[1], [
			1,
			2,
			'Bonjour',
			'#a1b2c3',
		]);
	} finally {
		query.mock.restore();
	}
});

test('retourne uniquement les post-its du bureau demandé', async () => {
	const query = mock.method(db, 'query', async () => ({
		rows: [
			{
				id: 5,
				deskId: 3,
				authorUsername: 'Alice',
				content: 'Réunion',
				color: '#ffcc00',
			},
		],
	}));

	try {
		const notes = await service.listNotes(3);

		assert.equal(notes.length, 1);
		assert.equal(notes[0].deskId, 3);
		assert.deepEqual(query.mock.calls[0].arguments[1], [3]);
	} finally {
		query.mock.restore();
	}
});
