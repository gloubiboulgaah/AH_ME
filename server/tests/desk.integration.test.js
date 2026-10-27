/** @format */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { io } = require('socket.io-client');

const URL = 'http://localhost:3001';
const ENABLED = process.env.RUN_DESK_INTEGRATION === '1';
const TIMEOUT = 8000;

function waitFor(socket, event, predicate = () => true) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			socket.off(event, handler);
			reject(new Error(`Timeout waiting for ${event}`));
		}, TIMEOUT);

		function handler(data) {
			if (!predicate(data)) return;
			clearTimeout(timer);
			socket.off(event, handler);
			resolve(data);
		}

		socket.on(event, handler);
	});
}

async function request(path, method = 'GET', body, cookie) {
	const response = await fetch(`${URL}${path}`, {
		method,
		headers: {
			...(body === undefined
				? {}
				: { 'Content-Type': 'application/json' }),
			...(cookie ? { Cookie: cookie } : {}),
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
		signal: AbortSignal.timeout(TIMEOUT),
	});

	const data = await response.json();

	return {
		status: response.status,
		data,
		cookie: response.headers.get('set-cookie')?.split(';')[0],
	};
}

async function register(username) {
	const response = await request('/auth/register', 'POST', {
		username,
		email: `${username.toLowerCase()}@example.test`,
		password: `Test-${randomUUID()}`,
	});

	assert.equal(response.status, 201, JSON.stringify(response.data));
	assert.match(response.cookie || '', /^sid=/);

	return {
		user: response.data.user,
		cookie: response.cookie,
	};
}

async function connect(cookie) {
	const socket = io(URL, {
		autoConnect: false,
		transports: ['websocket'],
		reconnection: false,
		extraHeaders: { Cookie: cookie },
	});

	const initialized = waitFor(socket, 'init');
	const deskList = waitFor(socket, 'deskList');

	socket.connect();

	try {
		const [init, desks] = await Promise.all([initialized, deskList]);

		return { socket, init, desks };
	} catch (error) {
		socket.disconnect();
		throw error;
	}
}

test(
	'real authenticated desk integration',
	{ skip: !ENABLED, timeout: 30000 },
	async () => {
		const sockets = [];
		let owner;
		let serverId;

		try {
			const check = await request('/servers/current');

			assert.equal(check.status, 401);

			owner = await register(`owner_${randomUUID().slice(0, 8)}`);
			const member = await register(`member_${randomUUID().slice(0, 8)}`);

			const current = await request(
				'/servers/current',
				'GET',
				undefined,
				owner.cookie
			);

			assert.equal(current.status, 200);
			assert.equal(
				current.data.server,
				null,
				'Test database already contains a server; refusing to modify it'
			);

			const created = await request(
				'/servers',
				'POST',
				{
					name: 'Socket Integration Test',
					capacity: 10,
					visibility: 'public',
				},
				owner.cookie
			);

			assert.equal(created.status, 201, JSON.stringify(created.data));
			serverId = created.data.server.id;

			const joined = await request(
				`/servers/${serverId}/join`,
				'POST',
				{},
				member.cookie
			);

			assert.equal(joined.status, 200, JSON.stringify(joined.data));

			const alice = await connect(owner.cookie);
			sockets.push(alice.socket);

			assert.equal(alice.init.player.userId, owner.user.id);
			assert.ok(Number.isInteger(alice.desks.mySlotIndex));

			const aliceDesk = alice.desks.desks.find(
				(desk) => desk.userId === owner.user.id
			);

			assert.ok(aliceDesk);
			assert.equal(aliceDesk.slotIndex, alice.desks.mySlotIndex);

			const assigned = waitFor(
				alice.socket,
				'deskAssigned',
				(data) => data.userId === member.user.id
			);

			const bob = await connect(member.cookie);
			sockets.push(bob.socket);

			const assignedDesk = await assigned;

			assert.equal(bob.init.player.userId, member.user.id);
			assert.ok(Number.isInteger(bob.desks.mySlotIndex));
			assert.notEqual(bob.desks.mySlotIndex, alice.desks.mySlotIndex);
			assert.equal(assignedDesk.slotIndex, bob.desks.mySlotIndex);

			const bobDesk = bob.desks.desks.find(
				(desk) => desk.userId === member.user.id
			);

			assert.ok(bobDesk);
			assert.equal(assignedDesk.deskId, bobDesk.deskId);

			const ownerContent = waitFor(
				bob.socket,
				'deskContent',
				(data) => data.slotIndex === aliceDesk.slotIndex
			);

			alice.socket.emit('deskContent', {
				deskId: aliceDesk.deskId,
				slotIndex: aliceDesk.slotIndex,
			});

			const content = await ownerContent;

			assert.equal(content.slotIndex, aliceDesk.slotIndex);
			assert.equal(typeof content.content.files, 'number');
			assert.equal(typeof content.content.notes, 'number');

			let unauthorizedBroadcast = false;

			function onContent(data) {
				if (data.slotIndex === aliceDesk.slotIndex) {
					unauthorizedBroadcast = true;
				}
			}

			alice.socket.on('deskContent', onContent);

			try {
				bob.socket.emit('deskContent', {
					deskId: aliceDesk.deskId,
					slotIndex: aliceDesk.slotIndex,
				});

				await new Promise((resolve) => setTimeout(resolve, 300));

				assert.equal(unauthorizedBroadcast, false);
			} finally {
				alice.socket.off('deskContent', onContent);
			}

			const released = waitFor(
				alice.socket,
				'deskReleased',
				(data) => data.slotIndex === bobDesk.slotIndex
			);

			bob.socket.emit('deskLeave');

			const releasedDesk = await released;

			assert.equal(releasedDesk.slotIndex, bobDesk.slotIndex);

			bob.socket.disconnect();

			const reconnected = await connect(member.cookie);
			sockets.push(reconnected.socket);

			assert.ok(Number.isInteger(reconnected.desks.mySlotIndex));

			const finalRelease = waitFor(
				alice.socket,
				'deskReleased',
				(data) => data.slotIndex === reconnected.desks.mySlotIndex
			);

			reconnected.socket.emit('deskLeave');
			await finalRelease;
		} finally {
			for (const socket of sockets) {
				socket.disconnect();
			}

			if (serverId && owner) {
				const deleted = await request(
					`/servers/${serverId}`,
					'DELETE',
					undefined,
					owner.cookie
				);

				assert.equal(
					deleted.status,
					200,
					`Test server cleanup failed: ${JSON.stringify(deleted.data)}`
				);
			}
		}
	}
);
