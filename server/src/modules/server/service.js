/** @format */

const crypto = require('crypto');
const db = require('../../db/pool');

function httpError(status, code, message) {
	const error = new Error(message);
	error.status = status;
	error.code = code;
	return error;
}

function generateInviteCode() {
	return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function hashInviteCode(code) {
	return crypto.createHash('sha256').update(code).digest('hex');
}

function normalizeVisibility(visibility) {
	return visibility === 'private' ? 'private' : 'public';
}

async function getCurrentServer() {
	const { rows } = await db.query(`
                SELECT
                        id,
                        name,
                        owner_id,
                        capacity,
                        visibility,
                        created_at
                FROM servers
                WHERE is_active = true
                ORDER BY created_at ASC
                LIMIT 1
        `);

	if (!rows[0]) return null;

	const server = rows[0];

	const membersResult = await db.query(
		`
                SELECT
                        u.id,
                        u.username,
                        sm.role,
                        sm.joined_at
                FROM server_members sm
                JOIN users u ON u.id = sm.user_id
                WHERE sm.server_id = $1
                ORDER BY sm.joined_at ASC
                `,
		[server.id]
	);

	return {
		...server,
		members: membersResult.rows,
	};
}

async function createServer({
	name,
	capacity = 20,
	visibility = 'public',
	ownerId,
}) {
	const cleanName = String(name || '').trim();

	if (!cleanName) {
		throw httpError(
			400,
			'INVALID_SERVER_NAME',
			'Le nom du serveur est obligatoire.'
		);
	}

	if (cleanName.length > 128) {
		throw httpError(
			400,
			'INVALID_SERVER_NAME',
			'Le nom du serveur ne peut pas dépasser 128 caractères.'
		);
	}

	const numericCapacity = Number(capacity);

	if (
		!Number.isInteger(numericCapacity) ||
		numericCapacity < 2 ||
		numericCapacity > 50
	) {
		throw httpError(
			400,
			'INVALID_CAPACITY',
			'La capacité doit être comprise entre 2 et 50.'
		);
	}

	const cleanVisibility = normalizeVisibility(visibility);
	const client = await db.pool.connect();

	try {
		await client.query('BEGIN');

		let inviteCode = null;
		let inviteCodeHash = null;

		if (cleanVisibility === 'private') {
			inviteCode = generateInviteCode();
			inviteCodeHash = hashInviteCode(inviteCode);
		}

		const { rows } = await client.query(
			`
                        INSERT INTO servers (
                                name,
                                visibility,
                                invite_code_hash,
                                capacity,
                                owner_id
                        )
                        VALUES ($1, $2, $3, $4, $5)
                        RETURNING
                                id,
                                name,
                                owner_id,
                                capacity,
                                visibility,
                                created_at
                        `,
			[
				cleanName,
				cleanVisibility,
				inviteCodeHash,
				numericCapacity,
				ownerId,
			]
		);

		const server = rows[0];

		await client.query(
			`
                        INSERT INTO server_members (
                                server_id,
                                user_id,
                                role
                        )
                        VALUES ($1, $2, 'owner')
                        `,
			[server.id, ownerId]
		);

		await client.query('COMMIT');

		return {
			...server,
			inviteCode,
		};
	} catch (error) {
		await client.query('ROLLBACK');

		if (error.code === '23505') {
			throw httpError(
				409,
				'SERVER_ALREADY_EXISTS',
				'Un serveur existe déjà.'
			);
		}

		throw error;
	} finally {
		client.release();
	}
}

async function deleteServer(serverId, userId) {
	const serverResult = await db.query(
		`
                SELECT id, owner_id
                FROM servers
                WHERE id = $1
                AND is_active = true
                `,
		[serverId]
	);

	const server = serverResult.rows[0];

	if (!server) {
		throw httpError(
			404,
			'SERVER_NOT_FOUND',
			'Le serveur demandé est introuvable.'
		);
	}

	if (server.owner_id !== userId) {
		throw httpError(
			403,
			'SERVER_OWNER_REQUIRED',
			'Seul le propriétaire peut supprimer le serveur.'
		);
	}

	await db.query('DELETE FROM servers WHERE id = $1', [serverId]);
}

async function joinServer(serverId, userId, inviteCode) {
	const client = await db.pool.connect();

	try {
		await client.query('BEGIN');

		const serverResult = await client.query(
			`
                        SELECT
                                id,
                                name,
                                owner_id,
                                capacity,
                                visibility,
                                invite_code_hash
                        FROM servers
                        WHERE id = $1
                        AND is_active = true
                        FOR UPDATE
                        `,
			[serverId]
		);

		const server = serverResult.rows[0];

		if (!server) {
			throw httpError(
				404,
				'SERVER_NOT_FOUND',
				'Le serveur demandé est introuvable.'
			);
		}

		const membership = await client.query(
			`
                        SELECT 1
                        FROM server_members
                        WHERE server_id = $1
                        AND user_id = $2
                        `,
			[serverId, userId]
		);

		if (membership.rowCount > 0) {
			await client.query('COMMIT');

			return {
				alreadyMember: true,
				server,
			};
		}

		if (server.visibility === 'private') {
			if (!inviteCode) {
				throw httpError(
					403,
					'INVITE_CODE_REQUIRED',
					'Un code d’invitation est requis.'
				);
			}

			const submittedHash = hashInviteCode(
				String(inviteCode).trim().toUpperCase()
			);

			if (
				!server.invite_code_hash ||
				submittedHash !== server.invite_code_hash
			) {
				throw httpError(
					403,
					'INVALID_INVITE_CODE',
					'Le code d’invitation est invalide.'
				);
			}
		}

		const countResult = await client.query(
			`
                        SELECT COUNT(*)::INTEGER AS count
                        FROM server_members
                        WHERE server_id = $1
                        `,
			[serverId]
		);

		const memberCount = countResult.rows[0].count;

		if (memberCount >= server.capacity) {
			throw httpError(
				409,
				'SERVER_FULL',
				`Le serveur est complet (${server.capacity} places maximum).`
			);
		}

		await client.query(
			`
                        INSERT INTO server_members (
                                server_id,
                                user_id,
                                role
                        )
                        VALUES ($1, $2, 'member')
                        `,
			[serverId, userId]
		);

		await client.query('COMMIT');

		return {
			alreadyMember: false,
			server,
		};
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function leaveServer(serverId, userId) {
	const serverResult = await db.query(
		`
                SELECT id, owner_id
                FROM servers
                WHERE id = $1
                AND is_active = true
                `,
		[serverId]
	);

	const server = serverResult.rows[0];

	if (!server) {
		throw httpError(
			404,
			'SERVER_NOT_FOUND',
			'Le serveur demandé est introuvable.'
		);
	}

	if (server.owner_id === userId) {
		throw httpError(
			400,
			'OWNER_CANNOT_LEAVE',
			'Le propriétaire ne peut pas quitter son serveur.'
		);
	}

	const result = await db.query(
		`
                DELETE FROM server_members
                WHERE server_id = $1
                AND user_id = $2
                `,
		[serverId, userId]
	);

	if (result.rowCount === 0) {
		throw httpError(
			404,
			'NOT_A_MEMBER',
			'Vous ne faites pas partie de ce serveur.'
		);
	}
}

async function regenerateInviteCode(serverId, userId) {
	const serverResult = await db.query(
		`
                SELECT id, owner_id, visibility
                FROM servers
                WHERE id = $1
                AND is_active = true
                `,
		[serverId]
	);

	const server = serverResult.rows[0];

	if (!server) {
		throw httpError(
			404,
			'SERVER_NOT_FOUND',
			'Le serveur demandé est introuvable.'
		);
	}

	if (server.owner_id !== userId) {
		throw httpError(
			403,
			'SERVER_OWNER_REQUIRED',
			'Seul le propriétaire peut régénérer le code d’invitation.'
		);
	}

	if (server.visibility !== 'private') {
		throw httpError(
			400,
			'SERVER_NOT_PRIVATE',
			'Un serveur public ne possède pas de code d’invitation.'
		);
	}

	const inviteCode = generateInviteCode();

	await db.query(
		`
                UPDATE servers
                SET invite_code_hash = $1
                WHERE id = $2
                `,
		[hashInviteCode(inviteCode), serverId]
	);

	return inviteCode;
}

module.exports = {
	getCurrentServer,
	createServer,
	deleteServer,
	joinServer,
	leaveServer,
	regenerateInviteCode,
};
