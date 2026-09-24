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
		if (!data || typeof data.deskId !== 'number') return;

		try {
			io.emit('deskContent', {
				slotIndex: data.slotIndex,
				content: await service.contentFor(data.deskId),
			});
		} catch (err) {
			console.error('desk content:', err.message);
		}
	});
}

module.exports = { attach };
