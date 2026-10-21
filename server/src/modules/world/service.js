/** @format */

const db = require('../../db/pool');

// position sauvegardee uniquement pour les comptes, les invites restent en memoire
async function loadPlayer(userId) {
	const { rows } = await db.query(
		`SELECT p.x, p.y, p.z, p.color, p.skin, p.build, r.slug AS room
        FROM players p LEFT JOIN rooms r ON r.id = p.room_id
        WHERE p.user_id = $1`,
		[userId]
	);
	return rows[0] || null;
}

async function savePlayer(userId, { x, y, z, color, skin, build }) {
	await db.query(
		`INSERT INTO players (user_id, room_id, x, y, z, color, skin, build, last_seen)
        VALUES ($1, (SELECT id FROM rooms WHERE slug = 'lobby'), $2, $3, $4, $5, $6, $7, now())
        ON CONFLICT (user_id) DO UPDATE
        SET x = $2, y = $3, z = $4, color = $5, skin = $6, build = $7, last_seen = now()`,
		[userId, x, y, z, color, skin, build]
	);
}

module.exports = { loadPlayer, savePlayer };
