#!/usr/bin/env node
// Syncs the Raaji static catalog (js/data.js) with the DB.
// Pulls badge (and optionally price/old price) for each product from the
// products table, matching rows to static entries by primary-image basename.
//
// Usage (from backend/):
//   node scripts/sync-catalog.mjs            # sync badges only
//   node scripts/sync-catalog.mjs --prices   # also update price / old price
//
// After running, commit js/data.js and bump the data.js cache-bust version
// (?v=N) on the store HTML pages so visitors load the updated catalog.
import 'dotenv/config';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pool from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(here, '../../js/data.js');
const syncPrices = process.argv.includes('--prices');

const baseOf = (u) => String(u || '').replace(/\\/g, '/').split('/').pop().toLowerCase();

async function loadDbCatalog() {
  const { rows } = await pool.query(
    `SELECT p.id, p.badge, p.price, p.old_price,
            COALESCE(img.image_url, '') AS img
       FROM products p
       LEFT JOIN product_images img ON img.product_id = p.id AND img.is_primary = TRUE
      WHERE p.is_active = TRUE`
  );
  const byImg = new Map();
  for (const r of rows) {
    const k = baseOf(r.img);
    if (k && !byImg.has(k)) byImg.set(k, r);
  }
  return byImg;
}

function rebuild(dataJs, byImg) {
  const arrMatch = dataJs.match(/let PRODUCTS = (\[[\s\S]*?\]);\n/);
  if (!arrMatch) throw new Error('Could not locate the PRODUCTS array in js/data.js');
  const products = eval(arrMatch[1]);
  const order = ['id', 'name', 'cat', 'subcat', 'price', 'old', 'badge', 'img', 'size', 'icon', 'grad', 'rating', 'desc', 'description'];
  let updated = 0;
  const missing = [];
  const lines = products.map((p, idx) => {
    const hit = baseOf(p.img) ? byImg.get(baseOf(p.img)) : null;
    if (hit) {
      if (hit.badge) { p.badge = hit.badge; updated++; }
      if (syncPrices) {
        if (hit.price != null && Number(hit.price) > 0) p.price = Number(hit.price);
        if (hit.old_price != null) p.old = Number(hit.old_price);
      }
    } else {
      missing.push(`${p.id}:${p.name}`);
    }
    const o = {};
    for (const k of order) if (p[k] !== undefined) o[k] = p[k];
    return `  ${JSON.stringify(o)}${idx < products.length - 1 ? ',' : ''}`;
  });
  const newArr = `let PRODUCTS = [\n${lines.join('\n')}\n];\n`;
  const out = newArr + dataJs.slice(arrMatch[0].length);
  return { out, updated, total: products.length, missing };
}

try {
  await new Promise((r) => setTimeout(r, 1000)); // wait for the connection pool
  const byImg = await loadDbCatalog();
  const dataJs = fs.readFileSync(dataPath, 'utf8');
  const { out, updated, total, missing } = rebuild(dataJs, byImg);
  fs.writeFileSync(dataPath, out);
  console.log(`Synced badges for ${updated}/${total} products${syncPrices ? ' (+ prices)' : ''}.`);
  if (missing.length) {
    console.log(`No DB match for ${missing.length} static products (left unchanged):`);
    console.log('  ' + missing.join(', '));
  }
  console.log(`Updated ${dataPath}`);
  console.log('Then bump the data.js ?v= cache-bust on the store HTML pages.');
  process.exit(0);
} catch (err) {
  console.error('sync-catalog failed:', err.message);
  process.exit(1);
}