/** @format */

const fs = require('fs');
const path = require('path');
const db = require('./pool');

// applique le schema au boot, idempotent
async function migrate() {
	const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
	await db.query(sql);
	console.log('db: schema ok');
}

module.exports = migrate;
