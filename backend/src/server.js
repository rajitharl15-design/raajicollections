import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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
import { requireAdmin, verifyCookies, verifyToken, signToken, setAdminCookie, clearAdminCookie, isConfigured, hasEnv, setSettings, effective, peacockConfigured, peacockUsername, validatePeacock, verifyPeacockAuth, setPeacockCookie, clearPeacockCookie, setPeacockSettings, hashPassword, verifyPassword, isHashed } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*', credentials: true, allowedHeaders: ['Content-Type', 'x-admin-key', 'Cache-Control', 'Pragma', 'Expires'] }));
app.use(express.json({ limit: '25mb' }));

// Avoid stale-cached admin/html/js so fixes go live immediately.
app.use((req, res, next) => {
  const p = req.path;
  if (p.startsWith('/api/') || p.startsWith('/js/') || p.startsWith('/css/') || p.endsWith('.html') || p === '/admin' || p === '/admin-login') {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

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
  // Not signed in (or not configured yet): send to the login page, which offers
  // first-time setup when no admin exists.
  const user = verifyCookies(req.headers) || verifyToken(req.get('x-admin-key'));
  if (!user) return res.redirect('/admin-login');
  // Hand the authenticated page a token so admin.js can authenticate API calls
  // via the x-admin-key header (robust even if cookie storage is an issue).
  try {
    const tok = signToken(user);
    const html = fs.readFileSync(adminHtml, 'utf8');
    const out = html.replace(
      '<script src="js/admin.js"></script>',
      '<script>try{localStorage.setItem(\'raaji_admin_key\', ' + JSON.stringify(tok) + ');}catch(e){}</script>\n  <script src="js/admin.js"></script>'
    );
    res.set('Content-Type', 'text/html').send(out);
  } catch (err) {
    res.sendFile(adminHtml);
  }
});
app.get('/admin-login', (req, res) => {
  if (verifyCookies(req.headers)) return res.redirect('/admin');
  res.sendFile(loginHtml);
});

// ---- Peacock store admin (separate login) ----
const peacockAdminHtml = path.join(privateDir, 'peacock-admin.html');
const peacockLoginHtml = path.join(privateDir, 'peacock-login.html');

app.get('/peacock-admin', (req, res) => {
  const user = verifyPeacockAuth(req.headers) || verifyToken(req.get('x-admin-key'));
  if (!user || user !== peacockUsername()) return res.redirect('/peacock-admin-login');
  const html = fs.readFileSync(peacockAdminHtml, 'utf8');
  const out = html.replace(
    '<script src="js/catalog-admin.js"></script>',
    '<script>try{localStorage.setItem(\'peacock_admin_key\', ' + JSON.stringify(signToken(peacockUsername())) + ');}catch(e){}</script>\n  <script src="js/catalog-admin.js"></script>'
  );
  res.set('Content-Type', 'text/html').send(out);
});
app.get('/peacock-admin-login', (req, res) => {
  if (verifyPeacockAuth(req.headers) === peacockUsername()) return res.redirect('/peacock-admin');
  res.sendFile(peacockLoginHtml);
});
app.post('/api/peacock-admin/login', async (req, res, next) => {
  try {
    const lim = rateLimit('peacock-login', req.ip || (req.socket && req.socket.remoteAddress));
    if (!lim.ok) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    const { username, password } = req.body || {};
    const dbCreds = peacockSettings; // DB-backed creds (upgradable to hash)
    const envCreds = (!dbCreds && process.env.PEACOCK_ADMIN_USER && process.env.PEACOCK_ADMIN_PASS)
      ? { username: process.env.PEACOCK_ADMIN_USER, password: process.env.PEACOCK_ADMIN_PASS }
      : null;
    const creds = dbCreds || envCreds;
    if (creds && username === creds.username) {
      const v = verifyPassword(creds.password, password);
      if (v) {
        if (v === 'legacy' && dbCreds && !isHashed(creds.password)) {
          const hashed = hashPassword(password);
          await pool.query('UPDATE peacock_admin_settings SET password = $1 WHERE username = $2', [hashed, creds.username]);
          creds.password = hashed;
        }
        setPeacockCookie(res);
        return res.json({ ok: true });
      }
    }
    lim.fail();
    return res.status(401).json({ error: 'Incorrect username or password.' });
  } catch (err) { next(err); }
});
app.get('/api/peacock-admin/status', (req, res) => {
  res.json({ configured: peacockConfigured() });
});
app.post('/api/peacock-admin/setup', async (req, res) => {
  try {
    if (peacockConfigured()) return res.status(409).json({ error: 'Peacock admin is already configured.' });
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    await pool.query('INSERT INTO peacock_admin_settings(username, password) VALUES($1,$2)', [username.trim(), password]);
    setPeacockSettings({ username: username.trim(), password });
    setPeacockCookie(res);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Setup failed: ' + err.message });
  }
});
app.post('/api/peacock-admin/logout', (req, res) => {
  clearPeacockCookie(res);
  res.json({ ok: true });
});

// Published Peacock store catalog (public read)
app.get('/api/peacock/catalog', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT products, updated_at FROM peacock_catalog WHERE id = 1');
    if (rows.length === 0) return res.status(404).json({ error: 'No catalog published yet.' });
    const at = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : Date.now();
    res.set('Cache-Control', 'no-store');
    res.json({ products: rows[0].products, updated_at: at });
  } catch (err) { next(err); }
});

// Publish catalog from the Peacock admin (auth required)
app.post('/api/peacock-admin/publish', async (req, res, next) => {
  try {
    const user = verifyPeacockAuth(req.headers) || verifyToken(req.get('x-admin-key'));
    if (!user || user !== peacockUsername()) return res.status(401).json({ error: 'Unauthorized' });
    const { products } = req.body || {};
    if (!Array.isArray(products)) return res.status(400).json({ error: 'products must be an array' });
    await pool.query(
      `INSERT INTO peacock_catalog(id, products, updated_at) VALUES(1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET products = EXCLUDED.products, updated_at = NOW()`,
      [JSON.stringify(products)]
    );
    res.json({ ok: true, count: products.length });
  } catch (err) { next(err); }
});

// Record a Peacock store order (public - from the storefront checkout)
app.post('/api/peacock/orders', async (req, res, next) => {
  try {
    const { name, phone, address, items, total } = req.body || {};
    if (!name || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'name and items are required' });
    }
    const orderNumber = 'PFA' + Date.now().toString(36).toUpperCase();
    const r = await pool.query(
      `INSERT INTO peacock_orders(order_number, customer_name, phone, address, items, total)
       VALUES($1, $2, $3, $4, $5, $6) RETURNING id, order_number`,
      [orderNumber, String(name).trim(), phone || null, address || null, JSON.stringify(items), Number(total) || 0]
    );
    res.json({ ok: true, order_number: r.rows[0].order_number });
  } catch (err) { next(err); }
});

// List Peacock store orders (admin)
app.get('/api/peacock-admin/orders', async (req, res, next) => {
  try {
    const user = verifyPeacockAuth(req.headers) || verifyToken(req.get('x-admin-key'));
    if (!user || user !== peacockUsername()) return res.status(401).json({ error: 'Unauthorized' });
    const { rows } = await pool.query(
      `SELECT id, order_number, customer_name, phone, address, items, total, status, payment_status, created_at
         FROM peacock_orders ORDER BY id DESC LIMIT 200`
    );
    res.json({ orders: rows });
  } catch (err) { next(err); }
});

// Update a Peacock order's status / payment (admin)
app.patch('/api/peacock-admin/orders/:id', async (req, res, next) => {
  try {
    const user = verifyPeacockAuth(req.headers) || verifyToken(req.get('x-admin-key'));
    if (!user || user !== peacockUsername()) return res.status(401).json({ error: 'Unauthorized' });
    const { status, payment_status } = req.body || {};
    const allowed = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];
    if (status && !allowed.includes(status)) return res.status(400).json({ error: 'invalid order status' });
    if (payment_status && !['pending', 'paid'].includes(payment_status)) return res.status(400).json({ error: 'invalid payment status' });
    await pool.query(
      `UPDATE peacock_orders SET
         status = COALESCE($1, status),
         payment_status = COALESCE($2, payment_status)
       WHERE id = $3`,
      [status || null, payment_status || null, req.params.id]
    );
    const { rows } = await pool.query('SELECT id, order_number, status, payment_status FROM peacock_orders WHERE id = $1', [req.params.id]);
    res.json({ order: rows[0] });
  } catch (err) { next(err); }
});

// ---- Admin authentication ----
const limiterBuckets = new Map();
function rateLimit(group, id) {
  const key = group + ':' + id;
  const now = Date.now();
  const win = 15 * 60 * 1000; // 15 minutes
  const rec = limiterBuckets.get(key) || { n: 0, start: now };
  if (now - rec.start > win) { rec.n = 0; rec.start = now; }
  if (rec.n >= 10) return { ok: false, fail() {} };
  limiterBuckets.set(key, rec);
  return { ok: true, fail() { rec.n++; limiterBuckets.set(key, rec); } };
}

app.post('/api/admin/login', async (req, res, next) => {
  try {
    const lim = rateLimit('admin-login', req.ip || (req.socket && req.socket.remoteAddress));
    if (!lim.ok) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    const { username, password } = req.body || {};
    const e = effective();
    if (e && username === e.username) {
      const v = verifyPassword(e.password, password);
      if (v) {
        if (v === 'legacy' && !hasEnv()) {
          const hashed = hashPassword(password);
          await pool.query('UPDATE admin_settings SET password = $1 WHERE username = $2', [hashed, e.username]);
          e.password = hashed; // update the in-memory settings object too
        }
        setAdminCookie(res);
        return res.json({ ok: true });
      }
    }
    lim.fail();
    return res.status(401).json({ error: 'Incorrect username or password.' });
  } catch (err) { next(err); }
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

async function loadPeacockSettings() {
  try {
    const { rows } = await pool.query('SELECT username, password FROM peacock_admin_settings ORDER BY id LIMIT 1');
    setPeacockSettings(rows[0] ? { username: rows[0].username, password: rows[0].password } : null);
    console.log('[auth] peacock admin settings loaded from DB:', rows[0] ? 'yes' : 'no');
  } catch (err) {
    setPeacockSettings(null);
    console.warn('[auth] could not load peacock admin settings (DB may be off):', err.message);
  }
}

async function start() {
  try {
    await initDbConnection();
    await loadAdminSettings();
    await loadPeacockSettings();
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
