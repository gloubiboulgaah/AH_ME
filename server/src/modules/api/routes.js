/** @format */

const { Router } = require('express');
const { players } = require('../world/socket');
const db = require('../../db/pool');

const router = Router();

router.get('/health', (req, res) => {
	res.json({
		status: 'ok',
		players: players.size,
		uptime: process.uptime(),
	});
});

router.get('/guest-username/available', async (req, res, next) => {
  try {
    const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';
    if (username.length < 3 || username.length > 20) return res.status(400).json({ available: false, error: 'Pseudo invalide.' });
    const existing = await db.query('SELECT 1 FROM users WHERE lower(username) = lower($1) LIMIT 1', [username]);
    const connected = [...players.values()].some(player => player.username?.toLowerCase() === username.toLowerCase());
    res.json({ available: existing.rows.length === 0 && !connected });
  } catch (error) { next(error); }
});

module.exports = router;
