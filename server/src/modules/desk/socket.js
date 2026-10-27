/** @format */

const service = require('./service');

function attach(io, socket) {
	const user = socket.data.user;

	const init = async () => {
		if (user) {
			const assigned = await service.assign(user.id);

			if (assigned.deskId) {
				socket.data.deskSlot = assigned.slotIndex;

				socket.broadcast.emit('deskAssigned', {
					deskId: assigned.deskId,
					slotIndex: assigned.slotIndex,
					userId: user.id,
					username: socket.data.username,
					content: await service.contentFor(assigned.deskId),
				});
			} else if (assigned.reason === 'full') {
				socket.emit('deskFull');
			}
		}

		socket.emit('deskList', {
			mySlotIndex: socket.data.deskSlot ?? null,
			desks: await service.list(),
		});
	};

	init().catch((err) => console.error('desk init:', err.message));

	// le joueur quitte le salon pour de bon, l'emplacement est libere
	socket.on('deskLeave', async () => {
		if (!user) return;

		try {
			const released = await service.release(user.id);

			if (released) {
				socket.data.deskSlot = null;
				io.emit('deskReleased', { slotIndex: released.slotIndex });
			}
		} catch (err) {
			console.error('desk leave:', err.message);
		}
	});

	// rafraichit l'apparence 3D apres un depot ou un post-it

	socket.on('deskContent', async (data) => {
		if (!user || !data || typeof data !== 'object') return;

		const { deskId, slotIndex } = data;

		if (!Number.isSafeInteger(deskId) || !Number.isSafeInteger(slotIndex)) {
			return;
		}

		try {
			const desks = await service.list();

			const desk = desks.find(
				(item) => item.deskId === deskId && item.slotIndex === slotIndex
			);

			if (!desk) return;

			// Seul le propriétaire du bureau peut demander
			// une actualisation de son contenu.
			if (desk.userId !== user.id) return;

			io.emit('deskContent', {
				slotIndex: desk.slotIndex,
				content: await service.contentFor(desk.deskId),
			});
		} catch (err) {
			console.error('desk content:', err.message);
		}
	});
}

module.exports = { attach };
