/** @format */

const { players } = require('../world/socket');

const MAX_LEN = 300;

function attach(io, socket) {
	socket.on('chatMessage', (message) => {
		const player = players.get(socket.id);
		if (!player || typeof message !== 'string') return;

		io.emit('chatMessage', {
			playerId: socket.id,
			username: player.username,
			message: message.slice(0, MAX_LEN),
			timestamp: Date.now(),
		});
	});

	socket.on('privateMessage', (data) => {
		const sender = players.get(socket.id);
		if (!sender || !data || !data.to || typeof data.message !== 'string')
			return;

		io.to(data.to).emit('privateMessage', {
			from: socket.id,
			fromUsername: sender.username,
			message: data.message.slice(0, MAX_LEN),
			timestamp: Date.now(),
		});
	});

	socket.on('emote', (data) => {
		const sender = players.get(socket.id);
		if (!sender || !data || !data.to || !data.type) return;

		io.to(data.to).emit('emote', {
			from: socket.id,
			fromUsername: sender.username,
			type: String(data.type),
			timestamp: Date.now(),
		});
	});
}

module.exports = { attach };
