import { fileURLToPath } from 'url';
import { dirname, extname, join } from 'path';
import fs from 'fs';
import multer, { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';


// THE FIX: Define __dirname manually for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_DIR = join(__dirname, '../../uploads/beneficiary-documents');

// Ensure folder exists so the server doesn't crash on boot
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, JPG, PNG, and WEBP are allowed.'), false);
    }
};

const documentsUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export default documentsUpload;
