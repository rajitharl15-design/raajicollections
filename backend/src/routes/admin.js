import { Router } from 'express';
import pool from '../db.js';

const router = Router();

const ALLOWED_ORDER_STATUS = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'];
const ALLOWED_PAYMENT_STATUS = ['pending', 'paid', 'failed', 'refunded'];

function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key');
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireAdmin);

// GET /api/admin/categories
router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug FROM categories WHERE is_active = TRUE ORDER BY sort_order, name`
    );
    res.json({ categories: rows });
  } catch (err) { next(err); }
});

// POST /api/admin/products  -> create product with multiple images
router.post('/products', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      name,
      category_id,
      price,
      old_price,
      stock_qty = 0,
      badge = null,
      material = null,
      description = null,
      images = [],          // [{ dataUrl, alt }]
      is_featured = false,
      is_active = true,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!category_id) return res.status(400).json({ error: 'category_id is required' });
    if (price == null || Number(price) < 0) return res.status(400).json({ error: 'price is required' });

    await client.query('BEGIN');

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const productRes = await client.query(
      `INSERT INTO products (name, slug, category_id, description, price, old_price,
                             badge, material, is_featured, is_active, stock_qty)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, slug, price, old_price, badge, stock_qty`,
      [name, slug, category_id, description || null,
       Number(price), old_price != null ? Number(old_price) : null,
       badge || null, material || null, is_featured, is_active, Number(stock_qty)]
    );
    const product = productRes.rows[0];

    // Insert images if provided
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await client.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [product.id, images[i].dataUrl, images[i].alt || name, i === 0, i]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ product });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'A product with this name/slug already exists' });
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/admin/orders  -> all orders with customer + item summary
router.get('/orders', async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    const where = [];
    if (status) {
      params.push(status);
      where.push(`o.status = $${params.length}`);
    }

    const orders = await pool.query(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.subtotal,
              o.shipping_fee, o.discount, o.total, o.shipping_name, o.shipping_city,
              o.shipping_state, o.shipping_pincode, o.created_at,
              c.first_name, c.phone, c.email,
              (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY o.created_at DESC`,
      params
    );
    res.json({ orders: orders.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/orders/:id  -> single order with items + payment
router.get('/orders/:id', async (req, res, next) => {
  try {
    const orderRes = await pool.query(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.subtotal,
              o.shipping_fee, o.discount, o.total, o.shipping_name, o.shipping_phone,
              o.shipping_address, o.shipping_city, o.shipping_state, o.shipping_pincode,
              o.notes, o.created_at, o.updated_at,
              c.id AS customer_id, c.first_name, c.last_name, c.email, c.phone
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
        WHERE o.id = $1`,
      [req.params.id]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const itemsRes = await pool.query(
      `SELECT id, product_id, product_name, unit_price, quantity, line_total
         FROM order_items WHERE order_id = $1`,
      [req.params.id]
    );
    const paymentRes = await pool.query(
      `SELECT id, method, upi_id, transaction_id, amount, status, payment_date
         FROM payments WHERE order_id = $1 ORDER BY id`,
      [req.params.id]
    );

    res.json({ order: { ...orderRes.rows[0], items: itemsRes.rows, payments: paymentRes.rows } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/orders/:id  -> update status / payment_status / payment transaction
router.patch('/orders/:id', async (req, res, next) => {
  try {
    const { status, payment_status, transaction_id } = req.body;

    if (status && !ALLOWED_ORDER_STATUS.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${ALLOWED_ORDER_STATUS.join(', ')}` });
    }
    if (payment_status && !ALLOWED_PAYMENT_STATUS.includes(payment_status)) {
      return res.status(400).json({ error: `payment_status must be one of: ${ALLOWED_PAYMENT_STATUS.join(', ')}` });
    }

    const orderRes = await pool.query(
      `SELECT id, status, payment_status FROM orders WHERE id = $1`,
      [req.params.id]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    const newStatus = status || order.status;
    const newPaymentStatus = payment_status || order.payment_status;

    const updated = await pool.query(
      `UPDATE orders
          SET status = $1, payment_status = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING id, order_number, status, payment_status, total, updated_at`,
      [newStatus, newPaymentStatus, req.params.id]
    );

    if (transaction_id || (payment_status && payment_status === 'paid')) {
      await pool.query(
        `UPDATE payments
            SET transaction_id = COALESCE($1::varchar, transaction_id),
                status = $2::varchar,
                payment_date = CASE WHEN $2 = 'success' THEN NOW() ELSE payment_date END
          WHERE order_id = $3`,
        [transaction_id || null, payment_status === 'paid' ? 'success' : 'pending', req.params.id]
      );
    }

    res.json({ order: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/products  -> list all products with primary image
router.get('/products', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.slug, p.price, p.old_price, p.stock_qty, p.badge, p.is_featured, p.is_active,
              p.category_id,
              c.name AS category_name,
              COALESCE(img.image_url, '/images/dress.svg') AS image_url
         FROM products p
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN LATERAL (
           SELECT image_url FROM product_images
           WHERE product_id = p.id AND is_primary = TRUE
           ORDER BY sort_order LIMIT 1
         ) img ON TRUE
        ORDER BY p.id`
    );
    res.json({ products: rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/products/:slug  -> update name / price / old_price / stock / badge
router.patch('/products/:slug', async (req, res, next) => {
  try {
    const { name, price, old_price, stock_qty, badge, is_featured, is_active, category_id } = req.body;

    if (name != null && (!name.trim() || name.length > 200)) {
      return res.status(400).json({ error: 'name must be non-empty and under 200 chars' });
    }
    if (price != null && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ error: 'price must be a non-negative number' });
    }
    if (old_price != null && old_price !== '' && (!Number.isFinite(Number(old_price)) || Number(old_price) < Number(price))) {
      return res.status(400).json({ error: 'old_price must be >= price' });
    }
    if (stock_qty != null && (!Number.isInteger(Number(stock_qty)) || Number(stock_qty) < 0)) {
      return res.status(400).json({ error: 'stock_qty must be a non-negative integer' });
    }
    if (category_id != null && (!Number.isInteger(Number(category_id)) || Number(category_id) < 1)) {
      return res.status(400).json({ error: 'category_id must be a positive integer' });
    }

    const updated = await pool.query(
      `UPDATE products
          SET name = COALESCE($1::varchar, name),
              price = COALESCE($2::numeric, price),
              old_price = CASE WHEN $3::text = '' THEN NULL ELSE COALESCE($3::numeric, old_price) END,
              stock_qty = COALESCE($4::int, stock_qty),
              badge = COALESCE($5::varchar, badge),
              is_featured = COALESCE($6::boolean, is_featured),
              is_active = COALESCE($7::boolean, is_active),
              category_id = COALESCE($8::int, category_id),
              updated_at = NOW()
        WHERE slug = $9
        RETURNING id, name, slug, price, old_price, badge, stock_qty, is_featured, is_active, category_id`,
      [
        name != null && name.trim() ? name.trim() : null,
        price != null ? Number(price) : null,
        old_price != null ? old_price : null,
        stock_qty != null ? Number(stock_qty) : null,
        badge != null ? badge : null,
        is_featured != null ? is_featured : null,
        is_active != null ? is_active : null,
        category_id != null ? Number(category_id) : null,
        req.params.slug,
      ]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
