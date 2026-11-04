/** @format */
const db = require('../../db/pool');

async function send(senderId, recipientId, message) {
	const found = await db.query('SELECT 1 FROM users WHERE id=$1', [
		recipientId,
	]);
	if (!found.rows.length) throw new Error('Destinataire introuvable');
	const { rows } = await db.query(
		`INSERT INTO private_messages(sender_id,recipient_id,body) VALUES($1,$2,$3) RETURNING id,created_at`,
		[senderId, recipientId, message]
	);
	return rows[0];
}

async function inbox(userId) {
	const { rows } = await db.query(
		`SELECT pm.id,pm.sender_id,pm.recipient_id,pm.body,pm.created_at,pm.read_at,
   sender.username AS sender_username,recipient.username AS recipient_username
   FROM private_messages pm JOIN users sender ON sender.id=pm.sender_id
   JOIN users recipient ON recipient.id=pm.recipient_id
   WHERE pm.sender_id=$1 OR pm.recipient_id=$1 ORDER BY pm.created_at DESC,pm.id DESC LIMIT 200`,
		[userId]
	);
	return rows.reverse();
}
async function markRead(userId, peerId) {
	await db.query(
		`UPDATE private_messages SET read_at=now() WHERE recipient_id=$1 AND sender_id=$2 AND read_at IS NULL`,
		[userId, peerId]
	);
}
module.exports = { send, inbox, markRead };
