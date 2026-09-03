import crypto from 'crypto';

// Simple signed-cookie session for the admin area.
// Secret from AUTH_SECRET env; admin credentials from ADMIN_USER / ADMIN_PASS env.
export const ADMIN_COOKIE = 'raaji_admin';

function secret() {
  return process.env.AUTH_SECRET || 'dev-secret-change-me';
}

export function isConfigured() {
  return !!(process.env.ADMIN_USER && process.env.ADMIN_PASS);
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
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch (e) { return null; }
  if (!data.u || data.exp < Date.now()) return null;
  return data.u;
}

export function requireAdmin(req, res, next) {
  if (!isConfigured()) {
    // Security not configured yet: refuse admin actions rather than be open.
    return res.status(403).json({ error: 'Admin is not configured (set ADMIN_USER / ADMIN_PASS / AUTH_SECRET).' });
  }
  const user = verifyCookies(req.headers);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.adminUser = user;
  next();
}

export function setAdminCookie(res) {
  const value = signToken(process.env.ADMIN_USER);
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`);
}

export function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}