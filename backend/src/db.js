import 'dotenv/config';
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:mayur@localhost:5432/raaji_collections';

// Determine whether to use SSL.
//   * DB_SSL=1  -> always on (rejectUnauthorized:false)
//   * DB_SSL=0  -> always off
//   * DB_SSL unset -> auto: on for external/public hosts (e.g. proxy.rlwy.net,
//                     *.railway.app not ".internal"), off for localhost so
//                     internal private-network connections work out of the box.
function resolveSsl() {
  if (process.env.DB_SSL === '1' || process.env.DB_SSL === 'true') return { rejectUnauthorized: false };
  if (process.env.DB_SSL === '0' || process.env.DB_SSL === 'false') return false;
  if (DB_URL.includes('.railway.internal') || DB_URL.includes('localhost')) return false;
  return { rejectUnauthorized: false };
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: resolveSsl(),
});

pool.on('error', err => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
