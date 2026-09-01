import 'dotenv/config';
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:mayur@localhost:5432/raaji_collections';

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
