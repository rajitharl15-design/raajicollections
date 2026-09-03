import crypto from 'crypto';

export const ADMIN_COOKIE = 'raaji_admin';

// Credentials come from env (highest priority) OR from a row in the admin_settings
// table (loaded into memory). Settings loaded from the DB avoid needing Render env vars.
let settings = null; // { username, password, secret }

export function setSettings(s) { settings = s || null; }
export function getSettings() { return settings; }

export function hasEnv() {
  return !!(process.env.ADMIN_USER && process.env.ADMIN_PASS);
}

export function effective() {
  if (hasEnv()) return { username: process.env.ADMIN_USER, password: process.env.ADMIN_PASS, secret: process.env.AUTH_SECRET || 'env-secret' };
  return settings;
}

export function isConfigured() {
  return !!effective();
}

function secret() {
  const e = effective();
  return e ? e.secret : 'dev-secret';
}

export function signToken(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}

export function verifyCookies(headers) {
  const raw = headers.cookie || '';
  const cookies = {};
  raw.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  const token = cookies[ADMIN_COOKIE];
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch (e) { return null; }
  if (!data.u || data.exp < Date.now()) return null;
  return data.u;
}

export function requireAdmin(req, res, next) {
  if (!isConfigured()) return res.status(403).json({ error: 'Admin is not configured yet (create credentials on the login page).' });
  const user = verifyCookies(req.headers);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.adminUser = user;
  next();
}

export function setAdminCookie(res) {
  const e = effective();
  const value = signToken(e.username);
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`);
}

export function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}