/** @format */

const service = require('./service');

const COLORS = [
	0x66ccff, 0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da,
	0xfcbad3,
];

function randomColor() {
	return COLORS[Math.floor(Math.random() * COLORS.length)];
}

const BUILDS = ['slim', 'standard', 'large'];

// apparence envoyee par le client au handshake, ignoree si invalide
function parseAvatar(raw) {
	if (!raw || typeof raw !== 'object') return null;

	const { skin, build } = raw;

	if (typeof skin !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(skin)) {
		return null;
	}
	if (!BUILDS.includes(build)) return null;

	return { skin, build };
}

// cache memoire de la salle, la db reste la source de verite pour les comptes
const players = new Map();
// Un compte = un avatar. Les autres onglets suivent cet avatar sans le dupliquer.
const accountControllers = new Map();
const accountTabs = new Map();

function attach(io, socket) {
	const user = socket.data.user;
	const accountKey = user ? String(user.id) : null;
	if (accountKey) {
		if (!accountTabs.has(accountKey)) accountTabs.set(accountKey, new Set());
		accountTabs.get(accountKey).add(socket.id);
		if (!accountControllers.has(accountKey)) accountControllers.set(accountKey, socket.id);
	}
	const isController = () => !accountKey || accountControllers.get(accountKey) === socket.id;

	const init = async () => {
		const saved = user ? await service.loadPlayer(user.id) : null;

		// le choix du navigateur l'emporte, sinon celui sauvegarde sur le compte
		const avatar =
			parseAvatar(socket.handshake.auth?.avatar) ||
			(saved && saved.skin
				? { skin: saved.skin, build: saved.build }
				: null);

		const player = {
			id: socket.id,
			userId: user ? user.id : null,
			username: socket.data.username,
			x: saved ? saved.x : 0,
			y: saved ? saved.y : 5,
			z: saved ? saved.z : 0,
			color: saved && saved.color ? saved.color : randomColor(),
			skin: avatar ? avatar.skin : null,
			build: avatar ? avatar.build : null,
			connected: Date.now(),
            room: socket.data.room,
		};
		if (socket.connected === false) return;
		if (!isController()) {
			const ownerId = accountControllers.get(accountKey);
			const owner = players.get(ownerId);
			// Un onglet secondaire ne cree jamais de deuxieme avatar.
			socket.emit('avatarControl', { active: false });
			socket.emit('init', { playerId: ownerId, player: owner || player });
			socket.emit('currentPlayers', Array.from(players.values()).filter(p => p.room === socket.data.room));
			return;
		}
		players.set(socket.id, player);
		socket.emit('avatarControl', { active: true });
		socket.emit('init', { playerId: socket.id, player });
		socket.emit('currentPlayers', Array.from(players.values()).filter(p => p.room === socket.data.room));
		socket.to(socket.data.room).emit('playerJoined', player);
		if (user) await service.savePlayer(user.id, player);
	};

	init().catch((err) => console.error('world init:', err.message));

	socket.on('playerMove', (data) => {
		const player = players.get(socket.id);
		if (!isController()) return;
		if (
			!player ||
			!data ||
			typeof data !== 'object' ||
			Array.isArray(data)
		) {
			return;
		}

		const coords = [data.x, data.y, data.z].map((value) => {
			return typeof value === 'number' && Number.isFinite(value) ? value : NaN;
		});
		if (coords.some((value) => !Number.isFinite(value) || Math.abs(value) > 10000)) return;
		[player.x, player.y, player.z] = coords;

		io.to(socket.data.room).emit('playerMoved', {
			id: socket.id,
			x: player.x,
			y: player.y,
			z: player.z,
		});

		if (player.userId) {
			service.savePlayer(player.userId, player).catch((err) => {
				console.error('world save:', err.message);
			});
		}
	});

	socket.on('disconnect', () => {
		if (accountKey) {
			const tabs = accountTabs.get(accountKey);
			tabs?.delete(socket.id);
			if (!tabs?.size) accountTabs.delete(accountKey);
			if (accountControllers.get(accountKey) === socket.id) {
				const nextId = tabs?.values().next().value;
				if (nextId) {
					accountControllers.set(accountKey, nextId);
					const nextSocket = io.sockets.sockets.get(nextId);
					const old = players.get(socket.id);
					if (old && nextSocket) {
						const replacement = { ...old, id: nextId };
						players.set(nextId, replacement);
						players.delete(socket.id);
						nextSocket.emit('avatarControl', { active: true });
						nextSocket.emit('init', { playerId: nextId, player: replacement });
						io.to(socket.data.room).emit('playerLeft', socket.id);
						io.to(socket.data.room).emit('playerJoined', replacement);
						return;
					}
				} else accountControllers.delete(accountKey);
			}
		}
		if (players.delete(socket.id)) socket.to(socket.data.room).emit('playerLeft', socket.id);
	});
}

module.exports = { attach, players };
