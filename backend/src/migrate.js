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

  console.log('[migrate] adding new categories...');
  try {
    await pool.query(`
      INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES
        ('Makeup & Gifts', 'makeup-gifts', 'Cosmetics, beauty essentials, gift sets & more', 'images/makeup-gifts.svg', 10)
      ON CONFLICT (slug) DO NOTHING;
    `);
    console.log('[migrate] categories done.');
  } catch (err) {
    console.warn('[migrate] category migration skipped:', err.message);
  }

  console.log('[migrate] adding sample makeup & gifts products...');
  try {
    const makeupCat = await pool.query(`SELECT id FROM categories WHERE slug = 'makeup-gifts'`);
    if (makeupCat.rows.length > 0) {
      const catId = makeupCat.rows[0].id;
      await pool.query(`
        INSERT INTO products (category_id, name, slug, description, price, old_price, badge, material, is_featured, stock_qty) VALUES
          ($1, 'Matte Lipstick Trio', 'matte-lipstick-trio', 'Set of three long-wear matte lipsticks in beautiful festive shades.', 549.00, 799.00, 'Sale', 'Makeup', TRUE, 20),
          ($1, 'Rose Gold Makeup Brush Set', 'rose-gold-makeup-brush-set', 'Premium 10-piece rose gold makeup brush set with soft synthetic bristles.', 899.00, NULL, 'New', 'Makeup', FALSE, 15),
          ($1, 'Handcrafted Gift Hamper', 'handcrafted-gift-hamper', 'Elegant gift hamper with assortment of beauty essentials and treats.', 1499.00, 1999.00, 'Sale', 'Gift', TRUE, 10),
          ($1, 'Compact Mirror with Comb', 'compact-mirror-comb', 'Stylish foldable compact mirror with comb, perfect for travel & gifting.', 399.00, NULL, NULL, 'Gift', FALSE, 30),
          ($1, 'Silk Eye Shadow Palette', 'silk-eyeshadow-palette', '12 rich shades of silky eye shadow with smooth blendable texture.', 749.00, NULL, 'New', 'Makeup', FALSE, 12),
          ($1, 'Golden Gift Box Set', 'golden-gift-box-set', 'Luxurious golden gift box with curated women gift items.', 999.00, 1299.00, 'Sale', 'Gift', FALSE, 8)
        ON CONFLICT (slug) DO NOTHING;
      `);
      for (const slug of ['matte-lipstick-trio', 'rose-gold-makeup-brush-set', 'handcrafted-gift-hamper', 'compact-mirror-comb', 'silk-eyeshadow-palette', 'golden-gift-box-set']) {
        await pool.query(`
          INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order)
          SELECT id, 'images/makeup-gifts.svg', name, TRUE, 1 FROM products WHERE slug = $1
          ON CONFLICT DO NOTHING
        `, [slug]);
      }
      console.log('[migrate] makeup & gifts products done.');
    }
  } catch (err) {
    console.warn('[migrate] makeup & gifts product migration skipped:', err.message);
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
