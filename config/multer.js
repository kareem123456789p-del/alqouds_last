/**
 * Multer Configuration — Invoice Image Archiving
 * Saves uploaded invoices to /public/uploads/invoices/
 * Accepts: JPEG, PNG, GIF, WebP (max 10 MB)
 */
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = path.join(__dirname, '../uploads/invoices');

// Ensure the directory exists at startup
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename:    (_req,  file, cb) => {
        const ext  = path.extname(file.originalname).toLowerCase();
        const name = `invoice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`;
        cb(null, name);
    }
});

const fileFilter = (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) &&
        allowed.test(file.mimetype.split('/')[1])) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed.'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

module.exports = upload;
