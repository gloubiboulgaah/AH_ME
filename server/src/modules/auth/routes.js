/** @format */

const { Router } = require('express');
const config = require('../../config');
const service = require('./service');

const router = Router();

const COOKIE = 'sid';
const cookieOpts = {
	httpOnly: true,
	sameSite: 'lax',
	secure:
		process.env.NODE_ENV === 'production' &&
		config.clientUrl.startsWith('https'),
	maxAge: config.sessionTtlDays * 24 * 3600 * 1000,
	path: '/',
};

router.post('/register', async (req, res, next) => {
	try {
		const user = await service.register(req.body || {});
		const session = await service.createSession(user.id);
		res.cookie(COOKIE, session.token, cookieOpts);
		res.status(201).json({ user });
	} catch (err) {
		next(err);
	}
});

router.post('/login', async (req, res, next) => {
	try {
		const user = await service.login(req.body || {});
		const session = await service.createSession(user.id);
		res.cookie(COOKIE, session.token, cookieOpts);
		res.json({ user });
	} catch (err) {
		next(err);
	}
});

router.post('/logout', async (req, res, next) => {
	try {
		await service.deleteSession(req.cookies[COOKIE]);
		res.clearCookie(COOKIE, { path: '/' });
		res.json({ ok: true });
	} catch (err) {
		next(err);
	}
});

router.get('/me', async (req, res, next) => {
	try {
		const user = await service.getSessionUser(req.cookies[COOKIE]);
		res.json({ user });
	} catch (err) {
		next(err);
	}
});

module.exports = router;
