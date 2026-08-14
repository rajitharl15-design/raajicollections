-- Raaji Collections - E-commerce Database Schema
-- PostgreSQL 16
-- Database: raaji_collections

BEGIN;

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL UNIQUE,
    slug          VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT,
    image_url     VARCHAR(500),
    sort_order    INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
    id            SERIAL PRIMARY KEY,
    category_id   INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name          VARCHAR(200) NOT NULL,
    slug          VARCHAR(200) NOT NULL UNIQUE,
    description   TEXT,
    price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    old_price     NUMERIC(10, 2) CHECK (old_price IS NULL OR old_price >= price),
    badge         VARCHAR(50),
    material      VARCHAR(100),
    is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    stock_qty     INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================
CREATE TABLE product_images (
    id            SERIAL PRIMARY KEY,
    product_id    INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url     TEXT NOT NULL,
    alt_text      VARCHAR(200),
    is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCT VARIANTS (size + color)
-- ============================================================
CREATE TABLE product_variants (
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

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
    id            SERIAL PRIMARY KEY,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100),
    email         VARCHAR(255) UNIQUE,
    phone         VARCHAR(20) UNIQUE,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city          VARCHAR(100),
    state         VARCHAR(100),
    pincode       VARCHAR(10),
    country       VARCHAR(100) NOT NULL DEFAULT 'India',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
    id                SERIAL PRIMARY KEY,
    order_number      VARCHAR(30) NOT NULL UNIQUE,
    customer_id       INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status            VARCHAR(30) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'packed', 'shipped',
                                        'delivered', 'cancelled', 'refunded')),
    payment_status    VARCHAR(30) NOT NULL DEFAULT 'pending'
                      CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    subtotal          NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    shipping_fee      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
    discount          NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    total             NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    shipping_name     VARCHAR(200),
    shipping_phone    VARCHAR(20),
    shipping_address  TEXT,
    shipping_area     VARCHAR(100),
    shipping_city     VARCHAR(100),
    shipping_state    VARCHAR(100),
    shipping_pincode  VARCHAR(10),
    tracking_carrier  VARCHAR(100),
    tracking_number   VARCHAR(100),
    confirm_code      VARCHAR(8),
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
    id            SERIAL PRIMARY KEY,
    order_id      INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    INT REFERENCES products(id) ON DELETE SET NULL,
    product_name  VARCHAR(200) NOT NULL,
    unit_price    NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity      INT NOT NULL CHECK (quantity > 0),
    line_total    NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
    size          VARCHAR(50),
    color         VARCHAR(100)
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
    id               SERIAL PRIMARY KEY,
    order_id         INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method           VARCHAR(30) NOT NULL DEFAULT 'upi'
                     CHECK (method IN ('upi', 'card', 'cod', 'bank_transfer')),
    upi_id           VARCHAR(100),
    transaction_id   VARCHAR(100),
    amount           NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    payment_date     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
    id            SERIAL PRIMARY KEY,
    product_id    INT REFERENCES products(id) ON DELETE CASCADE,
    customer_id   INT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(100) NOT NULL,
    rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       TEXT,
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================================
CREATE TABLE newsletter_subscribers (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_products_category    ON products(category_id);
CREATE INDEX idx_products_featured    ON products(is_featured) WHERE is_featured;
CREATE INDEX idx_product_images_prod  ON product_images(product_id);
CREATE INDEX idx_product_variants_prod ON product_variants(product_id);
CREATE INDEX idx_orders_customer      ON orders(customer_id);
CREATE INDEX idx_orders_status        ON orders(status);
CREATE INDEX idx_orders_created       ON orders(created_at DESC);
CREATE INDEX idx_order_items_order    ON order_items(order_id);
CREATE INDEX idx_order_items_product  ON order_items(product_id);
CREATE INDEX idx_payments_order       ON payments(order_id);
CREATE INDEX idx_reviews_product      ON reviews(product_id);
CREATE INDEX idx_reviews_customer     ON reviews(customer_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_categories_updated  BEFORE UPDATE ON categories  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated    BEFORE UPDATE ON products    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated   BEFORE UPDATE ON customers   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated      BEFORE UPDATE ON orders      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
