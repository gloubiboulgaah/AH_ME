/** @format */

const { Router } = require('express');

const authService = require('../auth/service');
const serverService = require('./service');
const deskService = require('../desk/service');

const router = Router();

async function getAuthenticatedUser(req) {
	return authService.getSessionUser(req.cookies?.sid);
}

async function requireUser(req, res) {
	const user = await getAuthenticatedUser(req);

	if (!user) {
		res.status(401).json({
			code: 'AUTH_REQUIRED',
			message: 'Vous devez être connecté.',
		});

		return null;
	}

	return user;
}

router.get('/current', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const server = await serverService.getCurrentServer();

		if (!server) {
			return res.json({
				server: null,
			});
		}

		res.json({
			server: {
				id: server.id,
				name: server.name,
				ownerId: server.owner_id,
				capacity: server.capacity,
				visibility: server.visibility,
				// meme forme que ServerMember cote client
				members: server.members.map((member) => ({
					id: member.id,
					username: member.username,
					role: member.role,
					joinedAt: member.joined_at,
				})),
			},
		});
	} catch (err) {
		next(err);
	}
});

router.post('/', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const server = await serverService.createServer({
			name: req.body?.name,
			capacity: req.body?.capacity,
			visibility: req.body?.visibility,
			ownerId: user.id,
		});

		res.status(201).json({
			server: {
				id: server.id,
				name: server.name,
				ownerId: server.owner_id,
				capacity: server.capacity,
				visibility: server.visibility,
			},
			inviteCode: server.inviteCode,
		});
	} catch (err) {
		next(err);
	}
});

router.delete('/:id', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const serverId = Number(req.params.id);

		if (!Number.isInteger(serverId)) {
			return res.status(400).json({
				code: 'INVALID_SERVER_ID',
				message: 'Identifiant de serveur invalide.',
			});
		}

		await serverService.deleteServer(serverId, user.id);

		res.json({
			ok: true,
		});
	} catch (err) {
		next(err);
	}
});

router.patch('/:id', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const serverId = Number(req.params.id);

		if (!Number.isInteger(serverId)) {
			return res.status(400).json({
				code: 'INVALID_SERVER_ID',
				message: 'Identifiant de serveur invalide.',
			});
		}

		const server = await serverService.updateServer(serverId, user.id, {
			name: req.body?.name,
			capacity: req.body?.capacity,
			visibility: req.body?.visibility,
		});

		res.json({
			server: {
				id: server.id,
				name: server.name,
				ownerId: server.owner_id,
				capacity: server.capacity,
				visibility: server.visibility,
			},
			inviteCode: server.inviteCode,
		});
	} catch (err) {
		next(err);
	}
});

router.delete('/:id/members/:userId', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const serverId = Number(req.params.id);
		const memberId = Number(req.params.userId);

		if (!Number.isInteger(serverId) || !Number.isInteger(memberId)) {
			return res.status(400).json({
				code: 'INVALID_ID',
				message: 'Identifiant invalide.',
			});
		}

		await serverService.removeMember(serverId, user.id, memberId);

		const released = await deskService.release(memberId);
		const io = req.app.get('io');

		if (io) {
			if (released) {
				io.emit('deskReleased', { slotIndex: released.slotIndex });
			}

			// le membre exclu sort du salon tout de suite, pas a sa prochaine
			// reconnexion
			const sockets = await io.fetchSockets();

			sockets
				.filter((socket) => socket.data.user?.id === memberId)
				.forEach((socket) => {
					socket.emit('serverKicked');
					socket.disconnect(true);
				});
		}

		res.json({
			ok: true,
		});
	} catch (err) {
		next(err);
	}
});

router.post('/:id/join', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const serverId = Number(req.params.id);

		if (!Number.isInteger(serverId)) {
			return res.status(400).json({
				code: 'INVALID_SERVER_ID',
				message: 'Identifiant de serveur invalide.',
			});
		}

		const result = await serverService.joinServer(
			serverId,
			user.id,
			req.body?.inviteCode
		);

		res.json({
			ok: true,
			code: result.alreadyMember ? 'ALREADY_MEMBER' : 'SERVER_JOINED',
			server: {
				id: result.server.id,
				name: result.server.name,
				ownerId: result.server.owner_id,
				capacity: result.server.capacity,
				visibility: result.server.visibility,
			},
		});
	} catch (err) {
		next(err);
	}
});

router.post('/:id/leave', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const serverId = Number(req.params.id);

		if (!Number.isInteger(serverId)) {
			return res.status(400).json({
				code: 'INVALID_SERVER_ID',
				message: 'Identifiant de serveur invalide.',
			});
		}

		await serverService.leaveServer(serverId, user.id);

		// sinon l'emplacement reste occupe par un non-membre
		const released = await deskService.release(user.id);
		const io = req.app.get('io');

		// les autres joueurs voient le bureau se vider sans recharger
		if (io && released) {
			io.emit('deskReleased', { slotIndex: released.slotIndex });
		}

		res.json({
			ok: true,
			releasedSlotIndex: released ? released.slotIndex : null,
		});
	} catch (err) {
		next(err);
	}
});

router.post('/:id/invite/regenerate', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const serverId = Number(req.params.id);

		if (!Number.isInteger(serverId)) {
			return res.status(400).json({
				code: 'INVALID_SERVER_ID',
				message: 'Identifiant de serveur invalide.',
			});
		}

		const inviteCode = await serverService.regenerateInviteCode(
			serverId,
			user.id
		);

		res.json({
			ok: true,
			inviteCode,
		});
	} catch (err) {
		next(err);
	}
});

module.exports = router;
