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

// SSL handling:
//   * DB_SSL=1 / 'true'  -> force SSL on (rejectUnauthorized:false)
//   * DB_SSL=0 / 'false' -> force SSL off
//   * DB_SSL unset       -> auto: SSL off for local + Railway internal hosts
//                           (private network, no TLS needed), SSL on otherwise
//                           (public proxies like proxy.rlwy.net, RDS, Neon).
function resolveSsl() {
  if (process.env.DB_SSL === '1' || process.env.DB_SSL === 'true') return { rejectUnauthorized: false };
  if (process.env.DB_SSL === '0' || process.env.DB_SSL === 'false') return false;
  const local = DB_URL.includes('localhost') || DB_URL.includes('127.0.0.1');
  const internal = DB_URL.includes('.railway.internal');
  return (local || internal) ? false : { rejectUnauthorized: false };
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: resolveSsl(),
  connectionTimeoutMillis: 10000,
});

pool.on('error', err => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
