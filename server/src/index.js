/** @format */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');

const config = require('./config');
const migrate = require('./db/migrate');
const authRoutes = require('./modules/auth/routes');
const authService = require('./modules/auth/service');
const apiRoutes = require('./modules/api/routes');
const world = require('./modules/world/socket');
const chat = require('./modules/chat/socket');

const app = express();
const server = http.createServer(app);

app.use(
	cors({
		origin: config.clientUrl,
		credentials: true,
	})
);

app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/', apiRoutes);

// Handler d'erreurs commun aux modules.
app.use((err, req, res, next) => {
	const status = err.status || 500;

	if (status >= 500) {
		console.error(err);
	}

	res.status(status).json({
		error: err.status ? err.message : 'erreur serveur',
	});
});

const io = new Server(server, {
	cors: {
		origin: config.clientUrl,
		methods: ['GET', 'POST'],
		credentials: true,
	},
});

// Cherche d'abord un utilisateur connecté grâce au cookie.
// Sinon, utilise le pseudo invité envoyé dans le handshake Socket.io.
io.use(async (socket, next) => {
	try {
		const cookies = cookie.parse(socket.handshake.headers.cookie || '');

		const sessionUser = cookies.sid
			? await authService.getSessionUser(cookies.sid)
			: null;

		const rawGuestUsername = socket.handshake.auth?.guestUsername;

		const guestUsername =
			typeof rawGuestUsername === 'string' ? rawGuestUsername.trim() : '';

		const isValidGuestUsername =
			guestUsername.length >= 3 && guestUsername.length <= 20;

		socket.data.user = sessionUser;
		socket.data.guestUsername =
			!sessionUser && isValidGuestUsername ? guestUsername : null;

		socket.data.username =
			sessionUser?.username ||
			socket.data.guestUsername ||
			`Guest_${socket.id.slice(0, 5)}`;

		next();
	} catch (error) {
		console.error(
			'socket auth:',
			error instanceof Error ? error.message : error
		);

		socket.data.user = null;
		socket.data.guestUsername = null;
		socket.data.username = `Guest_${socket.id.slice(0, 5)}`;

		next();
	}
});

io.on('connection', (socket) => {
	console.log(
		`[${new Date().toISOString()}] connexion: ${
			socket.id
		} (${socket.data.username})`
	);

	world.attach(io, socket);
	chat.attach(io, socket);

	socket.on('error', (error) => {
		console.error(`socket ${socket.id}:`, error);
	});
});

async function main() {
	await migrate();

	server.listen(config.port, '0.0.0.0', () => {
		console.log(`serveur pret sur :${config.port}`);
	});
}

main().catch((error) => {
	console.error('boot fail:', error);
	process.exit(1);
});

process.on('unhandledRejection', (reason) => {
	console.error('unhandled rejection:', reason);
});
