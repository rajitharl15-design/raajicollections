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
      UPDATE categories SET image_url = 'images/dresses-category.jpg' WHERE slug = 'dresses';
    `);
    console.log('[migrate] category images done.');
  } catch (err) {
    console.warn('[migrate] category image update skipped:', err.message);
  }

  console.log('[migrate] applying subcategory column...');
  try {
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50)`);
    console.log('[migrate] subcategory column done.');
  } catch (err) {
    console.warn('[migrate] subcategory migration skipped:', err.message);
  }

  console.log('[migrate] moving embedded images to files...');
  try {
    const IMAGE_MAP = {
      'jewellery-item-01': 'images/products/jewellery-item-01.jpg',
      'jewellery-item-02': 'images/products/jewellery-item-02.jpg',
      'jewellery-item-03': 'images/products/jewellery-item-03.jpg',
      'jewellery-item-08': 'images/products/jewellery-item-08.jpg',
      'jewellery-item-14': 'images/products/jewellery-item-14.jpg',
      'jewellery-item-16': 'images/products/jewellery-item-16.jpg',
      'jewellery-item-21': 'images/products/jewellery-item-21.jpg',
      'jewellery-item-22': 'images/products/jewellery-item-22.jpg',
      'jewellery-item-23': 'images/products/jewellery-item-23.jpg',
      'chain-with-lakshmi-pendant': 'images/products/chain-with-lakshmi-pendant.jpg',
      'kasula-peru': 'images/products/kasula-peru.jpg',
      'lakshmi-devi-pendant-and-ear-rings': 'images/products/lakshmi-devi-pendant-and-ear-rings.jpg',
      'lakshmidevi-long-chain-cz3-set': 'images/products/lakshmidevi-long-chain-cz3-set.jpg',
      'pearl-with-cz3-stone': 'images/products/pearl-with-cz3-stone.jpg',
      'green-beads-chain-with-cz3-and-pearls': 'images/products/green-beads-chain-with-cz3-and-pearls.jpg',
      'sarokasi-pearls': 'images/products/sarokasi-pearls.jpg',
      'emeralds-chain-set': 'images/products/emeralds-chain-set.jpg',
      'laksshmi-bangles': 'images/products/laksshmi-bangles.jpg',
      'bangle-set': 'images/products/bangle-set.jpg',
      'stone-bangles': 'images/products/stone-bangles.jpg',
      'buterfly': 'images/products/buterfly.jpg',
      'broso': 'images/products/broso.jpg',
      'copper-silk-saree': 'images/products/copper-silk-saree.jpg',
      'kota-cotton-silk': 'images/products/kota-cotton-silk.jpg',
      'soft-silk-zari': 'images/products/soft-silk-zari.jpg',
      'brown-copper-silk-saree': 'images/products/brown-copper-silk-saree.jpg',
      'chiffon-saree': 'images/products/chiffon-saree.jpg',
      'georgette': 'images/products/georgette.jpg',
      'purple-banara-cotton': 'images/products/purple-banara-cotton.jpg',
      'black-saree': 'images/products/black-saree.jpg',
      'tusser-silk': 'images/products/tusser-silk.jpg',
      'cotton-nighty': 'images/products/cotton-nighty.jpg',
      '4bangle-set': 'images/products/4bangle-set.jpg',
      '6-piece-bangle-set': 'images/products/6-piece-bangle-set.jpg',
      'black': 'images/products/black.jpg',
      'blue-5to6years': 'images/products/blue-5to6years.jpg',
      'blue-7to8years': 'images/products/blue-7to8years.jpg',
      'blue-9to10years': 'images/products/blue-9to10years.jpg',
      'brown-top': 'images/products/brown-top.jpg',
      'chord-set-green': 'images/products/chord-set-green.jpg',
      'green-top': 'images/products/green-top.jpg',
      'green-yellow-top': 'images/products/green-yellow-top.jpg',
      'kurti': 'images/products/kurti.jpg',
      'maroon-chrod-set': 'images/products/maroon-chrod-set.jpg',
      'pant-shirt-3to4years': 'images/products/pant-shirt-3to4years.jpg',
      'panchaloha-lifetime-gurantee': 'images/products/panchaloha-lifetime-gurantee.jpg',
      'pent-shirt-5to6years': 'images/products/pent-shirt-5to6years.jpg',
      'purple-frock': 'images/products/purple-frock.jpg',
      'rail-bangle': 'images/products/rail-bangle.jpg',
      'red-kurta': 'images/products/red-kurta.jpg',
      'red-silk-skirt': 'images/products/red-silk-skirt.jpg',
      'red-top': 'images/products/red-top.jpg',
      'rock-bangle-set': 'images/products/rock-bangle-set.jpg',
      'sarokasi-set': 'images/products/sarokasi-set.jpg',
      'satin-night-dress': 'images/products/satin-night-dress.jpg',
      'tusser': 'images/products/tusser.jpg',
      'white-kurta': 'images/products/white-kurta.jpg',
      'white-top': 'images/products/white-top.jpg',
      'yellow-set': 'images/products/yellow-set.jpg',
    };
    for (const [slug, filePath] of Object.entries(IMAGE_MAP)) {
      await pool.query(
        `UPDATE product_images pi
            SET image_url = $2
           FROM products p
          WHERE pi.product_id = p.id AND p.slug = $1 AND pi.is_primary = TRUE
            AND pi.image_url LIKE 'data:%'`,
        [slug, filePath]
      );
    }
    console.log('[migrate] embedded images moved to files.');
  } catch (err) {
    console.warn('[migrate] image file migration skipped:', err.message);
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
