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
const desk = require('./modules/desk/socket');
const {currentRoom} = require('./modules/world/access');
const db = require('./db/pool');
const serverRoutes = require('./modules/server/routes');
const deskFileRoutes = require('./modules/desk-files/routes');
const deskNoteRoutes = require('./modules/desk-notes/routes');

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
app.use('/servers', serverRoutes);
app.use('/desks', deskFileRoutes);
app.use('/desks', deskNoteRoutes);

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

// les routes http en ont besoin pour prevenir les joueurs connectes
app.set('io', io);

// Cherche d'abord un utilisateur connecté grâce au cookie.
// Sinon, utilise le pseudo invité envoyé dans le handshake Socket.io.
io.use(async (socket, next) => {
	try {
		const cookies = cookie.parse(socket.handshake.headers.cookie || '');

		const sessionUser = cookies.sid
            ? await authService.getSessionUser(cookies.sid)
            : null;
        if (cookies.sid && !sessionUser) return next(new Error('Session invalide'));

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

		next(new Error('Authentification indisponible'));
	}
});

io.on('connection', async (socket) => {
  try {
    if(!socket.data.user) {
      const username=socket.data.guestUsername;
      if(!username) {socket.emit('accessDenied','Pseudo invité invalide');socket.disconnect(true);return;}
      const registered=await db.query('SELECT 1 FROM users WHERE lower(username)=lower($1) LIMIT 1',[username]);
      const duplicate=[...io.sockets.sockets.values()].some(other=>other.id!==socket.id && other.data.username?.toLowerCase()===username.toLowerCase());
      if(registered.rows.length||duplicate) {socket.emit('accessDenied','Ce pseudo est déjà utilisé');socket.disconnect(true);return;}
    }
    const room = await currentRoom(socket.data.user);
    if (!room) { socket.emit('accessDenied', 'Accès au salon refusé'); socket.disconnect(true); return; }
    socket.data.room = room;
    await socket.join(room);
  } catch (error) { console.error('room access:',error.message); socket.disconnect(true); return; }

	console.log(
		`[${new Date().toISOString()}] connexion: ${
			socket.id
		} (${socket.data.username})`
	);

	// Les onglets du meme compte restent connectes. Le module world
	// attribue le controle de l'unique avatar a un seul onglet.

	world.attach(io, socket);
	chat.attach(io, socket);
	desk.attach(io, socket);

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
