import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage config: saves files to /uploads/projects/<projectId or temp>/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use a temp folder first; after project is created, move files if needed
    const uploadPath = path.join(__dirname, '../../uploads/projects/temp');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  },
});

export const upload = multer({ storage });
