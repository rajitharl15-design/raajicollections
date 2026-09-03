# Raaji Collections - Backend API

Express + PostgreSQL backend for the Raaji Collections e-commerce website. It serves both the API and the static website files.

## Tech Stack

- **Node.js** (>=18) + **Express**
- **PostgreSQL 16** (database: `raaji_collections`)
- Schema & seed in [`database/`](../database)

## Setup (local)

```bash
# 1. Create the database and apply schema/seed
sudo -u postgres psql -c "CREATE DATABASE raaji_collections;"
sudo -u postgres psql -d raaji_collections -f database/schema.sql
sudo -u postgres psql -d raaji_collections -f database/seed.sql

# 2. Create a DB user for the app
sudo -u postgres psql -d raaji_collections <<'SQL'
CREATE ROLE raaji_app WITH LOGIN PASSWORD 'CHANGE_ME';
GRANT CONNECT ON DATABASE raaji_collections TO raaji_app;
GRANT USAGE ON SCHEMA public TO raaji_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO raaji_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO raaji_app;
SQL

# 3. Configure and run
cd backend
cp .env.example .env    # edit DATABASE_URL
npm install
npm start               # http://localhost:3000
```

> **Auto-migration:** on boot, the server automatically applies `database/schema.sql` and
> `database/seed.sql` if the database is empty (idempotent — skips when already applied).
> Set `AUTO_MIGRATE=false` to disable, or `AUTO_MIGRATE=true` to fail startup if migration errors.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/categories` | List categories with product counts |
| GET | `/api/products` | List products (`?category=slug`, `?featured=true`) |
| GET | `/api/products/:slug` | Product detail + images + reviews |
| POST | `/api/orders` | Place an order (customer, items, payment) |
| GET | `/api/orders/:orderNumber` | Get order status |
| POST | `/api/newsletter/subscribe` | Subscribe email |
| POST | `/api/upload` | Upload a product image (returns `{ "url": "images/products/xxx.jpg" }`) |

### Image uploads

The admin panel (`/admin.html`) can add/remove product images at runtime.

```bash
# Upload an image (single file, field name: image)
curl -X POST http://localhost:3000/api/upload \
  -F "image=@/path/to/photo.jpg" \
  -H "x-upload-token: YOUR_TOKEN"   # only if UPLOAD_TOKEN is set
# -> {"url":"images/products/1788xxxx-abc.png","filename":"1788xxxx-abc.png"}
```

- By default files are saved to `<repo>/images/products/`, which is served statically — so the returned `url` is directly usable as a product image.
- If `UPLOAD_DIR` is set (e.g. a mounted disk at `/data`), files are stored there and served at `/uploads/<filename>` (returned URL starts with `/uploads/`).
- **Protect it with `UPLOAD_TOKEN`** and set the same value in the admin (Catalog Admin → link on admin page / `localStorage["pf_token"]`). If `UPLOAD_TOKEN` is empty, anyone can upload.

## Example: Place an order

## Example: Place an order

```json
POST /api/orders
{
  "customer": { "first_name": "Priya", "email": "priya@example.com", "phone": "9876543210" },
  "shipping": { "address": "123 Street", "city": "Mumbai", "state": "MH", "pincode": "400001" },
  "items": [{ "product_id": 1, "quantity": 2 }],
  "paymentMethod": "upi",
  "upiId": "priya@upi"
}
```

Free shipping is applied automatically for subtotals above ₹999.

## Deployment

Push this repo to GitHub and deploy `backend/` to a host that supports Node (e.g. Render, Railway, Fly.io). Set the environment variables:

- `DATABASE_URL` — your hosted Postgres URL (e.g. Neon, Supabase, Railway Postgres)
- `PORT` — default `3000`
- `CORS_ORIGIN` — your frontend domain(s), comma-separated
- `AUTO_MIGRATE` — default `true`; schema and seed are applied automatically on first boot
- `UPLOAD_TOKEN` — optional shared token that must be sent to `/api/upload`; leave unset for open uploads
- `UPLOAD_DIR` — optional absolute path for uploaded images (e.g. a mounted disk `/data`); served at `/uploads`

No manual `psql` step needed — the server migrates itself on startup.

### Catalog seeding (so the old site shows products)

- `database/seed.sql` creates the **categories**.
- `database/seed-catalog.sql` seeds the **products + product images** (your legacy uploads) and is
  applied automatically whenever the **products table is empty** — idempotent (`ON CONFLICT (slug) DO NOTHING`).
- This means a fresh database, **or a previously-deployed database that only has categories**, is
  auto-populated with the catalog on the next deploy/restart. No manual reload needed.

> Products migrated are grouped under the real categories (Sarees, Dresses, Tops, Ready Made Blouses,
> Jewellery, Night Dresses, Kids Wear). Auto-named uploads from misc/rakhi/try-on categories are
> skipped from the DB catalog (they remain on the new static site).

### Deploying on Render (so product images persist for all visitors)

Your site is currently hosted on **GitHub Pages (static), which has no server** — so admin image
uploads fall back to saving locally in the browser until you deploy this backend. To make uploads
permanent for everyone:

1. Create a **Render Web Service** from this repo (the included `Dockerfile` / `render.yaml` are ready).
2. Add a managed Postgres database (a `render.yaml` database block is included).
3. Set `UPLOAD_TOKEN` to a strong secret, and set the same secret in Catalog Admin
   (admin page → store it under `localStorage["pf_token"]`).
4. To keep images across redeploys, attach a **Render Disk** mounted at `/data` and set
   `UPLOAD_DIR=/data` — the free/standard filesystem is ephemeral otherwise.
   (Alternative: use S3 / Cloudinary for object storage.)
5. Point `CORS_ORIGIN` at your site, then open `${your-backend}/admin.html` to manage the catalog
   and upload images that are shared by every visitor.

> Tip: run the backend locally with `npm install && npm start` (default port 3000) to try uploads
> before deploying.
