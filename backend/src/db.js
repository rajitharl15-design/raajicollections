import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:mayur@localhost:5432/raaji_collections',
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false,
});

pool.on('error', err => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
