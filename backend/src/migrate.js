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
      'cotton-nighty': 'images/products/cotton-nighty.jpg',
      'girl-maroon-night-dress': 'images/products/girl-maroon-night-dress.jpg',
      'blue-5to6years': 'images/products/blue-5to6years.jpg',
      'boys-night-dress-5to6-year-old': 'images/products/boys-night-dress-5to6-year-old.jpg',
      'boys-7to8-years': 'images/products/boys-7to8-years.jpg',
      'boys': 'images/products/boys.jpg',
      'girls-7to8-years-old': 'images/products/girls-7to8-years-old.jpg',
      'nightdress': 'images/products/nightdress.jpg',
      'pink': 'images/products/pink.jpg',
      'red': 'images/products/red.jpg',
      'blue': 'images/products/blue.jpg',
      'black': 'images/products/black.jpg',
      'green': 'images/products/green.jpg',
      'navy': 'images/products/navy.jpg',
      'yellow': 'images/products/yellow.jpg',
      'light-freen': 'images/products/light-freen.jpg',
      'check-red': 'images/products/check-red.jpg',
      'red-color': 'images/products/red-color.jpg',
      'chain-with-lakshmi-pendant': 'images/products/chain-with-lakshmi-pendant.jpg',
      'kasula-peru': 'images/products/kasula-peru.jpg',
      'lakshmi-devi-pendant-and-ear-rings': 'images/products/lakshmi-devi-pendant-and-ear-rings.jpg',
      'lakshmidevi-long-chain-cz3-set': 'images/products/lakshmidevi-long-chain-cz3-set.jpg',
      'pearl-with-cz3-stone': 'images/products/pearl-with-cz3-stone.jpg',
      'green-beads-chain-with-cz3-and-pearls': 'images/products/green-beads-chain-with-cz3-and-pearls.jpg',
      'sarokasi-pearls': 'images/products/sarokasi-pearls.jpg',
      'emeralds-chain-set': 'images/products/emeralds-chain-set.jpg',
      'laksshmi-bangles': 'images/products/laksshmi-bangles.jpg',
      'chord-set-green': 'images/products/chord-set-green.jpg',
      'red-top': 'images/products/red-top.jpg',
      'maroon-chrod-set': 'images/products/maroon-chrod-set.jpg',
      '4bangle-set': 'images/products/4bangle-set.jpg',
      'kundan-bangles': 'images/products/kundan-bangles.jpg',
      '6-piece-bangle-set': 'images/products/6-piece-bangle-set.jpg',
      'cz3-stone-bangles': 'images/products/cz3-stone-bangles.jpg',
      'radha-krishna-bangles': 'images/products/radha-krishna-bangles.jpg',
      'kudan-stone-bangles': 'images/products/kudan-stone-bangles.jpg',
      'sita-ram-bangles': 'images/products/sita-ram-bangles.jpg',
      'emaralad-bangles': 'images/products/emaralad-bangles.jpg',
      'lakshmi-devi-flower-bangles': 'images/products/lakshmi-devi-flower-bangles.jpg',
      'tusser-silk': 'images/products/tusser-silk.jpg',
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
