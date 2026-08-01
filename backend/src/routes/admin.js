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

// PATCH /api/admin/products/:slug  -> update price / old_price / stock / badge
router.patch('/products/:slug', async (req, res, next) => {
  try {
    const { price, old_price, stock_qty, badge, is_featured } = req.body;

    if (price != null && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ error: 'price must be a non-negative number' });
    }
    if (old_price != null && old_price !== '' && (!Number.isFinite(Number(old_price)) || Number(old_price) < Number(price))) {
      return res.status(400).json({ error: 'old_price must be >= price' });
    }
    if (stock_qty != null && (!Number.isInteger(Number(stock_qty)) || Number(stock_qty) < 0)) {
      return res.status(400).json({ error: 'stock_qty must be a non-negative integer' });
    }

    const updated = await pool.query(
      `UPDATE products
          SET price = COALESCE($1::numeric, price),
              old_price = CASE WHEN $2::text = '' THEN NULL ELSE COALESCE($2::numeric, old_price) END,
              stock_qty = COALESCE($3::int, stock_qty),
              badge = COALESCE($4::varchar, badge),
              is_featured = COALESCE($5::boolean, is_featured),
              updated_at = NOW()
        WHERE slug = $6 AND is_active = TRUE
        RETURNING id, name, slug, price, old_price, badge, stock_qty, is_featured`,
      [
        price != null ? Number(price) : null,
        old_price != null ? old_price : null,
        stock_qty != null ? Number(stock_qty) : null,
        badge != null ? badge : null,
        is_featured != null ? is_featured : null,
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
