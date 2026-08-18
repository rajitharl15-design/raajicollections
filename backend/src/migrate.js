import { readFile } from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../');
const SCHEMA_FILE = path.join(repoRoot, 'database', 'schema.sql');
const SEED_FILE = path.join(repoRoot, 'database', 'seed.sql');

async function hasSchema() {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'categories'
     ) AS exists`
  );
  return rows[0].exists;
}

async function isSeeded() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM categories');
  return rows[0].count > 0;
}

export async function migrate() {
  console.log('[migrate] checking schema...');

  const schemaExists = await hasSchema();
  if (!schemaExists) {
    console.log('[migrate] applying schema.sql...');
    const sql = await readFile(SCHEMA_FILE, 'utf8');
    await pool.query(sql);
    console.log('[migrate] schema applied.');
  } else {
    console.log('[migrate] schema already present, skipping.');
  }

  const seeded = await isSeeded();
  if (!seeded) {
    console.log('[migrate] applying seed.sql...');
    const sql = await readFile(SEED_FILE, 'utf8');
    await pool.query(sql);
    console.log('[migrate] seed applied.');
  } else {
    console.log('[migrate] data already seeded, skipping.');
  }

  console.log('[migrate] applying column migrations...');
  try {
    await pool.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS tracking_carrier VARCHAR(100),
        ADD COLUMN IF NOT EXISTS tracking_number  VARCHAR(100),
        ADD COLUMN IF NOT EXISTS confirm_code     VARCHAR(8),
        ADD COLUMN IF NOT EXISTS shipping_area    VARCHAR(100);
    `);
    console.log('[migrate] column migrations done.');
  } catch (err) {
    // Non-superuser DB roles cannot ALTER tables owned by another user.
    // The app falls back gracefully (tracking merely shows as unavailable).
    console.warn('[migrate] column migrations skipped (no ALTER privilege):', err.message);
  }

  console.log('[migrate] updating category images...');
  try {
    await pool.query(`
      UPDATE categories SET image_url = 'images/jewellery-category.jpg' WHERE slug = 'jewellery';
    `);
    console.log('[migrate] category images done.');
  } catch (err) {
    console.warn('[migrate] category image update skipped:', err.message);
  }

  console.log('[migrate] applying variant migrations...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
          id            SERIAL PRIMARY KEY,
          product_id    INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          size          VARCHAR(50) NOT NULL,
          color         VARCHAR(100) NOT NULL,
          image_url     TEXT,
          price         NUMERIC(10, 2),
          stock_qty     INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
          is_active     BOOLEAN NOT NULL DEFAULT TRUE,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (product_id, size, color)
      );
      CREATE INDEX IF NOT EXISTS idx_product_variants_prod ON product_variants(product_id);
      ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS size  VARCHAR(50),
        ADD COLUMN IF NOT EXISTS color VARCHAR(100);
    `);
    console.log('[migrate] variant migrations done.');
  } catch (err) {
    console.warn('[migrate] variant migrations skipped:', err.message);
  }
}
