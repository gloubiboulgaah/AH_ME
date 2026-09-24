/** @format */

const service = require('./service');

// contenu des bureaux : bouchon en attendant les API fichiers et post-its
// de Safiya, qui ne sont pas encore mergees
// une fois branchees, remplacer par un COUNT sur desk_files / desk_notes
const mockContent = new Map();

function contentFor(slotIndex) {
	if (!mockContent.has(slotIndex)) {
		mockContent.set(slotIndex, {
			files: (slotIndex * 3) % 7,
			notes: (slotIndex * 2) % 5,
		});
	}

	return mockContent.get(slotIndex);
}

function withContent(desk) {
	return {
		...desk,
		content: contentFor(desk.slotIndex),
	};
}

function attach(io, socket) {
	const user = socket.data.user;

	const init = async () => {
		if (user) {
			const assigned = await service.assign(user.id);

			if (assigned) {
				socket.data.deskSlot = assigned.slotIndex;

				socket.broadcast.emit('deskAssigned', {
					slotIndex: assigned.slotIndex,
					userId: user.id,
					username: socket.data.username,
					content: contentFor(assigned.slotIndex),
				});
			} else {
				socket.emit('deskFull');
			}
		}

		const desks = await service.list();

		socket.emit('deskList', {
			mySlotIndex: socket.data.deskSlot ?? null,
			desks: desks.map(withContent),
		});
	};

	init().catch((err) => console.error('desk init:', err.message));

	// le joueur quitte le salon pour de bon, l'emplacement est libere
	socket.on('deskLeave', async () => {
		if (!user) return;

		try {
			const slotIndex = await service.release(user.id);

			if (slotIndex !== null) {
				socket.data.deskSlot = null;
				io.emit('deskReleased', { slotIndex });
			}
		} catch (err) {
			console.error('desk leave:', err.message);
		}
	});

	// TODO brancher sur les vraies tables quand les API de Safiya arrivent
	socket.on('deskContent', (data) => {
		if (!data || typeof data.slotIndex !== 'number') return;

		socket.emit('deskContent', {
			slotIndex: data.slotIndex,
			content: contentFor(data.slotIndex),
		});
	});
}

module.exports = { attach };
