/** @format */

const db = require('../../db/pool');

// doit rester aligne sur SALON_LAYOUT.deskSlots cote client
const SLOT_COUNT = 10;
const DEFAULT_ROOM_SLUG = 'lobby';

async function roomId(slug = DEFAULT_ROOM_SLUG) {
	const { rows } = await db.query('SELECT id FROM rooms WHERE slug = $1', [
		slug,
	]);

	if (!rows[0]) throw new Error(`salle introuvable: ${slug}`);
	return rows[0].id;
}

// cree les emplacements vides au premier passage
async function ensureSlots(room) {
	await db.query(
		`INSERT INTO desks (room_id, slot_index)
     SELECT $1, slot FROM generate_series(0, $2) AS slot
     ON CONFLICT (room_id, slot_index) DO NOTHING`,
		[room, SLOT_COUNT - 1]
	);
}

async function list(slug) {
	const room = await roomId(slug);
	await ensureSlots(room);

	const { rows } = await db.query(
		`SELECT d.slot_index, d.occupant_user_id, u.username
     FROM desks d LEFT JOIN users u ON u.id = d.occupant_user_id
     WHERE d.room_id = $1
     ORDER BY d.slot_index`,
		[room]
	);

	return rows.map((row) => ({
		slotIndex: row.slot_index,
		userId: row.occupant_user_id,
		username: row.username,
	}));
}

// rend l'emplacement deja tenu par le compte, sinon le premier libre
async function assign(userId, slug) {
	const room = await roomId(slug);
	await ensureSlots(room);

	const existing = await db.query(
		`SELECT slot_index FROM desks
     WHERE room_id = $1 AND occupant_user_id = $2`,
		[room, userId]
	);

	if (existing.rows[0]) {
		return { slotIndex: existing.rows[0].slot_index, reused: true };
	}

	const { rows } = await db.query(
		`UPDATE desks SET occupant_user_id = $2, assigned_at = now()
     WHERE id = (
       SELECT id FROM desks
       WHERE room_id = $1 AND occupant_user_id IS NULL
       ORDER BY slot_index
       LIMIT 1
     )
     RETURNING slot_index`,
		[room, userId]
	);

	if (!rows[0]) return null;
	return { slotIndex: rows[0].slot_index, reused: false };
}

// appele quand le compte quitte le salon, pas a la simple deconnexion
async function release(userId, slug) {
	const room = await roomId(slug);

	const { rows } = await db.query(
		`UPDATE desks SET occupant_user_id = NULL, assigned_at = NULL
     WHERE room_id = $1 AND occupant_user_id = $2
     RETURNING slot_index`,
		[room, userId]
	);

	return rows[0] ? rows[0].slot_index : null;
}

module.exports = {
	SLOT_COUNT,
	list,
	assign,
	release,
};
