import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import ordersRouter from './routes/orders.js';
import newsletterRouter from './routes/newsletter.js';
import admRouter from './routes/admin.js';
import uploadRouter from './routes/upload.js';
import { migrate } from './migrate.js';
import pool, { initDbConnection } from './db.js';
import crypto from 'crypto';
import { requireAdmin, verifyCookies, setAdminCookie, clearAdminCookie, isConfigured, hasEnv, setSettings, effective } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*' }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'raaji-collections-backend' });
});

// ---- Secure admin area (gates run BEFORE express.static so /admin.html is not served open) ----
const publicDir = path.resolve(__dirname, '../../');
// Admin/login pages live in backend/private (NOT the publicly-served site root).
const privateDir = path.resolve(__dirname, '../private');
const adminHtml = path.join(privateDir, 'admin.html');
const loginHtml = path.join(privateDir, 'login.html');

app.get(['/admin', '/admin.html'], (req, res) => {
  if (!isConfigured()) return res.status(500).send('<h3>Admin is not configured (set ADMIN_USER / ADMIN_PASS / AUTH_SECRET).</h3>');
  if (!verifyCookies(req.headers)) return res.redirect('/admin-login');
  res.sendFile(adminHtml);
});
app.get('/admin-login', (req, res) => {
  if (verifyCookies(req.headers)) return res.redirect('/admin');
  res.sendFile(loginHtml);
});

// ---- Admin authentication ----
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const e = effective();
  if (e && username === e.username && password === e.password) {
    setAdminCookie(res);
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Incorrect username or password.' });
});

// First-time setup: create admin credentials (DB-backed, no env vars needed).
app.get('/api/admin/status', (req, res) => {
  res.json({ configured: isConfigured() });
});

app.post('/api/admin/setup', async (req, res) => {
  try {
    if (hasEnv()) return res.status(403).json({ error: 'Admin is configured via environment variables.' });
    if (isConfigured()) return res.status(409).json({ error: 'Admin is already configured.' });
    const { username, password, auth_secret } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const secret = (auth_secret && auth_secret.length >= 16) ? auth_secret : crypto.randomBytes(32).toString('hex');
    await pool.query('INSERT INTO admin_settings(username, password, auth_secret) VALUES($1,$2,$3)', [username, password, secret]);
    setSettings({ username, password, secret });
    setAdminCookie(res);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Setup failed: ' + err.message });
  }
});

app.post('/api/admin/logout', (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ ok: true, user: req.adminUser });
});

app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/admin', requireAdmin, admRouter);
app.use('/api/upload', requireAdmin, uploadRouter);

// Serve the static website (index.html, css/, js/, images/)
app.use(express.static(publicDir));
// Never expose backend source/config, database dumps, or git internals.
app.use(['/backend', '/database', '/.git', '/node_modules'], (req, res) => res.status(404).end());
if (process.env.UPLOAD_DIR) {
  app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR)));
}

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const msg = err.message || 'Internal server error';
  const extra = err && err.errors && err.errors.map(e => e.message).join(' | ');
  res.status(status).json({ error: msg, detail: (err && err.stack) || String(err), inner: extra, db: (process.env.DATABASE_URL || '').replace(/\/\/[^:]+:[^@]+@/, '//USER:PASS@') });
});

const PORT = process.env.PORT || 3000;

async function loadAdminSettings() {
  try {
    const { rows } = await pool.query('SELECT username, password, auth_secret FROM admin_settings ORDER BY id LIMIT 1');
    setSettings(rows[0] ? { username: rows[0].username, password: rows[0].password, secret: rows[0].auth_secret } : null);
    console.log('[auth] admin settings loaded from DB:', rows[0] ? 'yes' : 'no');
  } catch (err) {
    setSettings(null);
    console.warn('[auth] could not load admin settings (DB may be off):', err.message);
  }
}

async function start() {
  try {
    await initDbConnection();
    await loadAdminSettings();
  } catch (err) {
    console.error('[db] initDbConnection failed:', err.message);
  }
  if (process.env.AUTO_MIGRATE !== 'false') {
    try {
      await migrate();
    } catch (err) {
      console.error('[migrate] failed:', err.message);
      console.error('[migrate] DATABASE_URL host/port:',
        (process.env.DATABASE_URL || 'UNSET').replace(/\/\/[^:]+:[^@]+@/, '//USER:PASS@'));
      console.error('[migrate] full error:', err);
      if (process.env.AUTO_MIGRATE === 'true') process.exit(1);
    }
  }
  app.listen(PORT, () => {
    console.log(`Raaji Collections backend running on http://localhost:${PORT}`);
    console.log(`[raaji] build v4 (auto-ssl-probe) DB_SSL=${process.env.DB_SSL || 'auto'} DATABASE_URL=${(process.env.DATABASE_URL || 'UNSET').replace(/\/\/[^:]+:[^@]+@/, '//USER:PASS@')}`);
  });
}

start();
