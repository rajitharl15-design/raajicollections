import { Router } from 'express';
import pool from '../db.js';
import { hasTrackingColumns } from '../tracking-cols.js';

const router = Router();

// POST /api/orders  -> creates order + order_items + payment record
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      customer,           // { first_name, last_name, email, phone }
      shipping,           // { address, city, state, pincode }
      items,              // [{ product_id, quantity }]
      paymentMethod = 'upi',
      upiId,
      notes,
    } = req.body;

    if (!customer || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'customer and items are required' });
    }

    await client.query('BEGIN');

    // 1. Upsert customer
    const customerRes = await client.query(
      `INSERT INTO customers (first_name, last_name, email, phone,
                              address_line1, city, state, pincode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE
         SET first_name = EXCLUDED.first_name,
             last_name  = EXCLUDED.last_name,
             phone      = EXCLUDED.phone,
             address_line1 = EXCLUDED.address_line1,
             city       = EXCLUDED.city,
             state      = EXCLUDED.state,
             pincode    = EXCLUDED.pincode
       RETURNING id`,
      [
        customer.first_name || 'Guest',
        customer.last_name || null,
        customer.email || null,
        customer.phone || null,
        shipping?.address || null,
        shipping?.city || null,
        shipping?.state || null,
        shipping?.pincode || null,
      ]
    );
    const customerId = customerRes.rows[0].id;

    // 2. Fetch product prices + stock
    const ids = items.map(i => i.product_id);
    const productRes = await client.query(
      `SELECT id, name, price, stock_qty FROM products WHERE id = ANY($1) AND is_active = TRUE`,
      [ids]
    );
    const productMap = new Map(productRes.rows.map(p => [p.id, p]));

    let subtotal = 0;
    const orderLines = [];
    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) throw Object.assign(new Error(`Product ${item.product_id} not found`), { status: 400 });
      if (item.quantity > product.stock_qty) {
        throw Object.assign(new Error(`Insufficient stock for ${product.name}`), { status: 400 });
      }
      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;
      orderLines.push({ product, quantity: item.quantity, lineTotal });
    }

    const shippingFee = subtotal >= 999 ? 0 : 49;
    const discount = 0;
    const total = subtotal + shippingFee - discount;

    // 3. Create order
    const orderNumber = `RC${Date.now().toString(36).toUpperCase()}`;
    const orderRes = await client.query(
      `INSERT INTO orders (order_number, customer_id, status, payment_status,
                           subtotal, shipping_fee, discount, total,
                           shipping_name, shipping_phone, shipping_address,
                           shipping_city, shipping_state, shipping_pincode, notes)
       VALUES ($1, $2, 'pending', 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, order_number, total`,
      [
        orderNumber, customerId, subtotal, shippingFee, discount, total,
        customer.first_name, customer.phone || null, shipping?.address || null,
        shipping?.city || null, shipping?.state || null, shipping?.pincode || null,
        notes || null,
      ]
    );
    const order = orderRes.rows[0];

    // 4. Insert order items + decrement stock
    for (const line of orderLines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, line.product.id, line.product.name, line.product.price, line.quantity, line.lineTotal]
      );
      await client.query(`UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2`, [line.quantity, line.product.id]);
    }

    // 5. Record payment
    await client.query(
      `INSERT INTO payments (order_id, method, upi_id, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [order.id, paymentMethod, upiId || null, total]
    );

    await client.query('COMMIT');
    res.status(201).json({
      order_id: order.id,
      order_number: order.order_number,
      total,
      shipping_fee: shippingFee,
      status: 'pending',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/orders/:orderNumber
router.get('/:orderNumber', async (req, res, next) => {
  try {
    const tracking = await hasTrackingColumns();
    const trackingCols = tracking
      ? ', tracking_carrier, tracking_number'
      : '';
    const { rows } = await pool.query(
      `SELECT id, order_number, status, payment_status, subtotal, shipping_fee,
              discount, total, shipping_name${trackingCols}, created_at
         FROM orders WHERE order_number = $1`,
      [req.params.orderNumber]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
