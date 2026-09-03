import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Default: repo root's images/products (publicly served by express.static(publicDir)).
// When UPLOAD_DIR env is set (e.g. a mounted Render disk), files are stored there and
// served at /uploads by server.js, and the returned URL uses that mount prefix.
const useMount = !!process.env.UPLOAD_DIR;
const productsDir = useMount
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../../../images/products');
try {
  fs.mkdirSync(productsDir, { recursive: true });
} catch (err) {
  // Missing/mount-less disk (e.g. Render free plan): fall back to the repo folder
  // rather than crashing the server at boot.
  console.warn('[upload] products dir not writable, falling back to repo images/products:', err.message);
  process.env.UPLOAD_DIR = '';
  globalThis.__uploadDir = path.resolve(__dirname, '../../../images/products');
}
function dir() { return globalThis.__uploadDir || productsDir; }

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try { fs.mkdirSync(dir(), { recursive: true }); } catch (e) {}
    cb(null, dir());
  },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    const safe = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

const router = Router();

// Optional simple shared-token auth for uploads (UPLOAD_TOKEN in env)
function checkToken(req, res, next) {
  const token = process.env.UPLOAD_TOKEN;
  if (!token) return next();
  if (req.get('x-upload-token') === token) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

router.post('/', checkToken, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const realMount = useMount && !globalThis.__uploadDir;
  const url = realMount
    ? path.posix.join('/uploads', req.file.filename)
    : path.posix.join('images', 'products', req.file.filename);
  res.status(201).json({ url, filename: req.file.filename });
});

router.use((err, req, res, next) => {
  res.status(err.status || 400).json({ error: err.message || 'Upload failed' });
});

export default router;