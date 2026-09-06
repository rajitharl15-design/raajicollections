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

export function verifyToken(token) {
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

export function getCookieValue(headers, name) {
  const raw = headers.cookie || '';
  const cookies = {};
  raw.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies[name];
}

export function verifyCookies(headers) {
  return verifyToken(getCookieValue(headers, ADMIN_COOKIE));
}

// ---- Separate Peacock store admin (its own login/credentials) ----
export const PEACOCK_COOKIE = 'raaji_peacock_admin';

// Credentials come from env (highest priority) OR from a DB row in
// peacock_admin_settings (loaded into memory on boot). DB-backed setup means no
// Render env vars are needed - the owner creates them once on the login page.
// Note: gating (configured/setup) is based on the DB row only, so leftover
// PEACOCK_ADMIN_* Render env placeholders can't block the first-time setup.
let peacockSettings = null; // { username, password }
export function setPeacockSettings(s) { peacockSettings = s || null; }

export function peacockConfigured() {
  return !!peacockSettings;
}
function peacockCreds() {
  if (peacockSettings) return peacockSettings;
  if (process.env.PEACOCK_ADMIN_USER && process.env.PEACOCK_ADMIN_PASS) {
    return { username: process.env.PEACOCK_ADMIN_USER, password: process.env.PEACOCK_ADMIN_PASS };
  }
  return null;
}
export function peacockUsername() {
  const c = peacockCreds();
  return c ? c.username : '';
}
export function validatePeacock(username, password) {
  const c = peacockCreds();
  return !!c && username === c.username && password === c.password;
}
export function setPeacockCookie(res) {
  res.setHeader('Set-Cookie', `${PEACOCK_COOKIE}=${encodeURIComponent(signToken(peacockUsername()))}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=43200`);
}
export function clearPeacockCookie(res) {
  res.setHeader('Set-Cookie', `${PEACOCK_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
export function verifyPeacockAuth(headers) {
  return verifyToken(getCookieValue(headers, PEACOCK_COOKIE));
}
export function requirePeacockAdmin(req, res, next) {
  if (!peacockConfigured()) {
    return res.status(403).json({ error: 'Peacock admin is not configured (set PEACOCK_ADMIN_USER / PEACOCK_ADMIN_PASS env vars).' });
  }
  const user = verifyPeacockAuth(req.headers) || verifyToken(req.get('x-admin-key'));
  if (!user || user !== peacockUsername()) {
    return res.status(401).json({ error: 'Unauthorized', gotCookie: !!req.headers.cookie, gotHeader: !!req.get('x-admin-key') });
  }
  req.peacockUser = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (!isConfigured()) return res.status(403).json({ error: 'Admin is not configured yet (create credentials on the login page).' });
  // Accept the session cookie OR the x-admin-key token header (sent by admin.js page).
  const user = verifyCookies(req.headers) || verifyToken(req.get('x-admin-key'));
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', gotCookie: !!req.headers.cookie, gotHeader: !!req.get('x-admin-key') });
  }
  req.adminUser = user;
  next();
}

export function setAdminCookie(res) {
  const e = effective();
  const value = signToken(e.username);
  // SameSite=None + Secure so the session cookie is sent on same-origin AND
  // cross-origin API fetches (with CORS credentials). HttpOnly keeps it JS-invisible.
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=43200`);
}

export function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}