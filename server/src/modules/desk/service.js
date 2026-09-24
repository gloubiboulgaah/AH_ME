/** @format */

const db = require('../../db/pool');

// doit rester aligne sur SALON_LAYOUT.deskSlots cote client
const SLOT_COUNT = 10;

async function activeServerId() {
	const { rows } = await db.query(
		'SELECT id FROM servers WHERE is_active = true LIMIT 1'
	);

	return rows[0] ? rows[0].id : null;
}

// cree les emplacements vides du serveur au premier passage
async function ensureSlots(serverId) {
	await db.query(
		`INSERT INTO desks (server_id, slot_index)
		 SELECT $1, slot FROM generate_series(0, $2) AS slot
		 ON CONFLICT (server_id, slot_index) DO NOTHING`,
		[serverId, SLOT_COUNT - 1]
	);
}

async function isMember(serverId, userId) {
	const { rows } = await db.query(
		'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
		[serverId, userId]
	);

	return rows.length > 0;
}

// les compteurs alimentent l'apparence du bureau en 3D
async function list() {
	const serverId = await activeServerId();
	if (!serverId) return [];

	await ensureSlots(serverId);

	const { rows } = await db.query(
		`SELECT
			d.id,
			d.slot_index,
			d.owner_id,
			u.username,
			(SELECT COUNT(*) FROM desk_files f WHERE f.desk_id = d.id)::int
				AS files,
			(SELECT COUNT(*) FROM desk_notes n WHERE n.desk_id = d.id)::int
				AS notes
		 FROM desks d LEFT JOIN users u ON u.id = d.owner_id
		 WHERE d.server_id = $1
		 ORDER BY d.slot_index`,
		[serverId]
	);

	return rows.map((row) => ({
		deskId: row.id,
		slotIndex: row.slot_index,
		userId: row.owner_id,
		username: row.username,
		content: { files: row.files, notes: row.notes },
	}));
}

async function contentFor(deskId) {
	const { rows } = await db.query(
		`SELECT
			(SELECT COUNT(*) FROM desk_files f WHERE f.desk_id = $1)::int
				AS files,
			(SELECT COUNT(*) FROM desk_notes n WHERE n.desk_id = $1)::int
				AS notes`,
		[deskId]
	);

	return rows[0] || { files: 0, notes: 0 };
}

// rend l'emplacement deja tenu par le compte, sinon le premier libre
// reserve aux membres du serveur
async function assign(userId) {
	const serverId = await activeServerId();
	if (!serverId) return { reason: 'no-server' };

	if (!(await isMember(serverId, userId))) {
		return { reason: 'not-member' };
	}

	await ensureSlots(serverId);

	const existing = await db.query(
		'SELECT id, slot_index FROM desks WHERE server_id = $1 AND owner_id = $2',
		[serverId, userId]
	);

	if (existing.rows[0]) {
		return {
			deskId: existing.rows[0].id,
			slotIndex: existing.rows[0].slot_index,
			reused: true,
		};
	}

	const { rows } = await db.query(
		`UPDATE desks SET owner_id = $2, assigned_at = now()
		 WHERE id = (
			SELECT id FROM desks
			WHERE server_id = $1 AND owner_id IS NULL
			ORDER BY slot_index
			LIMIT 1
		 )
		 RETURNING id, slot_index`,
		[serverId, userId]
	);

	if (!rows[0]) return { reason: 'full' };

	return { deskId: rows[0].id, slotIndex: rows[0].slot_index, reused: false };
}

// appele quand le compte quitte le salon, pas a la simple deconnexion
// les fichiers et post-its du bureau sont supprimes avec lui
async function release(userId) {
	const serverId = await activeServerId();
	if (!serverId) return null;

	const { rows } = await db.query(
		`SELECT id, slot_index FROM desks
		 WHERE server_id = $1 AND owner_id = $2`,
		[serverId, userId]
	);

	if (!rows[0]) return null;

	await db.query('DELETE FROM desk_files WHERE desk_id = $1', [rows[0].id]);
	await db.query('DELETE FROM desk_notes WHERE desk_id = $1', [rows[0].id]);

	await db.query(
		`UPDATE desks SET owner_id = NULL, assigned_at = NULL
		 WHERE id = $1`,
		[rows[0].id]
	);

	return { deskId: rows[0].id, slotIndex: rows[0].slot_index };
}

module.exports = {
	SLOT_COUNT,
	list,
	contentFor,
	assign,
	release,
};
