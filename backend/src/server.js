import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import ordersRouter from './routes/orders.js';
import newsletterRouter from './routes/newsletter.js';
import admRouter from './routes/admin.js';
import uploadRouter from './routes/upload.js';
import { migrate } from './migrate.js';
import { initDbConnection } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*' }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'raaji-collections-backend' });
});

app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/admin', admRouter);
app.use('/api/upload', uploadRouter);

// Serve the static website (index.html, css/, js/, images/)
const publicDir = path.resolve(__dirname, '../../');
app.use(express.static(publicDir));
if (process.env.UPLOAD_DIR) {
  app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR)));
}

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const msg = err.message || 'Internal server error';
  const extra = err && err.errors && err.errors.map(e => e.message).join(' | ');
  res.status(status).json({ error: msg, detail: (err && err.stack) || String(err), inner: extra, db: (process.env.DATABASE_URL || '').replace(/\/\/[^:]+:[^@]+@/, '//USER:PASS@') });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDbConnection();
  } catch (err) {
    console.error('[db] initDbConnection failed:', err.message);
  }
  if (process.env.AUTO_MIGRATE !== 'false') {
    try {
      await migrate();
    } catch (err) {
      console.error('[migrate] failed:', err.message);
      console.error('[migrate] DATABASE_URL host/port:',
        (process.env.DATABASE_URL || 'UNSET').replace(/\/\/[^:]+:[^@]+@/, '//USER:PASS@'));
      console.error('[migrate] full error:', err);
      if (process.env.AUTO_MIGRATE === 'true') process.exit(1);
    }
  }
  app.listen(PORT, () => {
    console.log(`Raaji Collections backend running on http://localhost:${PORT}`);
    console.log(`[raaji] build v4 (auto-ssl-probe) DB_SSL=${process.env.DB_SSL || 'auto'} DATABASE_URL=${(process.env.DATABASE_URL || 'UNSET').replace(/\/\/[^:]+:[^@]+@/, '//USER:PASS@')}`);
  });
}

start();
