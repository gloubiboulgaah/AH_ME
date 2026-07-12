/** @format */

const bcrypt = require('bcryptjs');
const db = require('../../db/pool');
const config = require('../../config');

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;

async function register({ username, email, password }) {
	if (!USERNAME_RE.test(username || '')) {
		throw httpError(
			400,
			'pseudo invalide (3-32 caracteres, lettres/chiffres/_/-)'
		);
	}
	if (!email || !email.includes('@')) throw httpError(400, 'email invalide');
	if (!password || password.length < 8)
		throw httpError(400, 'mot de passe trop court (8 min)');

	const hash = await bcrypt.hash(password, 10);
	try {
		const { rows } = await db.query(
			'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
			[username, email.toLowerCase(), hash]
		);
		return rows[0];
	} catch (err) {
		if (err.code === '23505')
			throw httpError(409, 'pseudo ou email deja pris');
		throw err;
	}
}

async function login({ email, password }) {
	const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [
		(email || '').toLowerCase(),
	]);
	const user = rows[0];
	if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
		throw httpError(401, 'identifiants incorrects');
	}
	return { id: user.id, username: user.username, email: user.email };
}

async function createSession(userId) {
	const { rows } = await db.query(
		`INSERT INTO sessions (user_id, expires_at) VALUES ($1, now() + ($2 || ' days')::interval)
     RETURNING token, expires_at`,
		[userId, config.sessionTtlDays]
	);
	return rows[0];
}

async function getSessionUser(token) {
	if (!token) return null;
	const { rows } = await db.query(
		`SELECT u.id, u.username, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
		[token]
	);
	return rows[0] || null;
}

async function deleteSession(token) {
	if (!token) return;
	await db.query('DELETE FROM sessions WHERE token = $1', [token]);
}

function httpError(status, message) {
	const err = new Error(message);
	err.status = status;
	return err;
}

module.exports = {
	register,
	login,
	createSession,
	getSessionUser,
	deleteSession,
};
