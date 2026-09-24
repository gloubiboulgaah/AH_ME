/** @format */

const path = require('path');

module.exports = {
	port: process.env.PORT || 3000,
	clientUrl: process.env.CLIENT_URL || 'http://localhost:8080',
	databaseUrl:
		process.env.DATABASE_URL || 'postgres://ahme:ahme@localhost:5432/ahme',
	sessionTtlDays: 7,
	// docker passe FILE_STORAGE_PATH, en local on reste dans le depot
	fileStoragePath:
		process.env.FILE_STORAGE_PATH || path.join(__dirname, '..', 'uploads'),
	maxFileSize: 10 * 1024 * 1024,
	maxFilesPerDesk: 20,
};
