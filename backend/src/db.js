import 'dotenv/config';
import pg from 'pg';

// Connection source: prefer DATABASE_URL, else build from Railway's PG* vars
// (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE) that are auto-injected when
// a Postgres is linked to the service.
function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  if (PGHOST && PGDATABASE) {
    const auth = PGUSER ? `${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD || '')}@` : '';
    return `postgres://${auth}${PGHOST}:${PGPORT || '5432'}/${PGDATABASE}`;
  }
  return 'postgres://postgres:mayur@localhost:5432/raaji_collections';
}

const DB_URL = connectionString();

// Returns the SSL config to use. Auto-probes by trying to connect with each
// candidate and returns the first that succeeds. Handles Railway internal
// (no TLS), public proxies (TLS required), RDS/Neon (TLS), and localhost.
async function pickSsl() {
  if (process.env.DB_SSL === '1' || process.env.DB_SSL === 'true') return { rejectUnauthorized: false };
  if (process.env.DB_SSL === '0' || process.env.DB_SSL === 'false') return false;

  const candidates = [{ rejectUnauthorized: false }, false];
  for (const ssl of candidates) {
    try {
      const probe = new pg.Client({ connectionString: DB_URL, ssl, connectionTimeoutMillis: 6000 });
      await probe.connect();
      await probe.query('SELECT 1');
      await probe.end();
      console.log(`[db] SSL probe OK -> ssl=${JSON.stringify(ssl)}`);
      return ssl;
    } catch (e) {
      console.log(`[db] SSL probe failed ssl=${JSON.stringify(ssl)}: ${e.message}`);
    }
  }
  console.log('[db] SSL probe failed both; defaulting to TLS rejectUnauthorized:false');
  return { rejectUnauthorized: false };
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: false, // provisional; corrected by init below
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', err => {
  console.error('Unexpected error on idle client', err);
});

// Reconfigure the pool with the probed SSL mode (or DB_SSL override).
export async function initDbConnection() {
  const ssl = await pickSsl();
  pool.options.ssl = ssl;
  pool.options.connectionString = DB_URL;
  // Validate with one query so callers know the connection works.
  const client = await pool.connect();
  client.release();
  console.log('[db] initDbConnection OK');
}

export default pool;
