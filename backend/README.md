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

Apply the schema to the hosted DB:

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
```
