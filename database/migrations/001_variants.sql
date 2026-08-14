-- Migration: product variants (size + color) + order_items size/color
-- Applied to the live Railway database.

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

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size VARCHAR(50);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color VARCHAR(100);
