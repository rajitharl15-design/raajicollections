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
//   * DB_SSL=0 / 'false' -> SSL off
//   * otherwise          -> SSL on with rejectUnauthorized:false (handles
//                           Railway internal & public proxies, RDS, etc.)
function resolveSsl() {
  if (process.env.DB_SSL === '0' || process.env.DB_SSL === 'false') return false;
  return { rejectUnauthorized: false };
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
