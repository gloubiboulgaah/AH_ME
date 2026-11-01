/** @format */

const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

const config = require('../../config');

// accepte seulement les formats de fichiers autorises
const allowedExtensions = new Set([
	'.pdf',
	'.png',
	'.jpg',
	'.jpeg',
	'.webp',
	'.gif',
	'.txt',
	'.md',
	'.csv',
	'.docx',
	'.xlsx',
	'.pptx',
	'.zip',
]);
const signatures = {
	'.pdf': [Buffer.from('%PDF-')],
	'.png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
	'.jpg': [Buffer.from([0xff, 0xd8, 0xff])],
	'.jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
	'.webp': [Buffer.from('RIFF')],
	'.gif': [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
	'.docx': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
	'.xlsx': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
	'.pptx': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
	'.zip': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
};
function validSignature(extension, bytes) {
	if (!allowedExtensions.has(extension)) return false;
	if (!signatures[extension]) return !bytes.includes(0);
	return (
		signatures[extension].some((sig) =>
			bytes.subarray(0, sig.length).equals(sig)
		) &&
		(extension !== '.webp' || bytes.subarray(8, 12).toString() === 'WEBP')
	);
}

const storage = multer.diskStorage({
	destination: config.fileStoragePath,

	filename: (req, file, callback) => {
		const extension = path.extname(file.originalname).toLowerCase();
		const storedName = `${crypto.randomUUID()}${extension}`;

		callback(null, storedName);
	},
});

const upload = multer({
	storage,

	limits: {
		fileSize: config.maxFileSize,
	},

	fileFilter: (req, file, callback) => {
		const extension = path.extname(file.originalname).toLowerCase();

		if (!allowedExtensions.has(extension)) {
			return callback(new Error('type de fichier interdit'));
		}

		callback(null, true);
	},
});

module.exports = upload;
module.exports.validSignature = validSignature;
