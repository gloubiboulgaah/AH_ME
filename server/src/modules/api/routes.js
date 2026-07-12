/** @format */

const { Router } = require('express');
const { players } = require('../world/socket');

const router = Router();

router.get('/health', (req, res) => {
	res.json({
		status: 'ok',
		players: players.size,
		uptime: process.uptime(),
	});
});

module.exports = router;
