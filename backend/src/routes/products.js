import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/products  ?category=slug&featured=true
router.get('/', async (req, res, next) => {
  try {
    const { category, featured } = req.query;
    const params = [];
    const where = [];

    if (category) {
      params.push(category);
      where.push(`c.slug = $${params.length}`);
    }
    if (featured === 'true' || featured === '1') {
      where.push(`p.is_featured = TRUE`);
    }
    where.push(`p.is_active = TRUE`);

    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.slug, p.description, p.price, p.old_price,
              p.badge, p.material, p.is_featured, p.stock_qty,
              c.name AS category_name, c.slug AS category_slug,
              COALESCE(img.image_url, '/images/dress.svg') AS image_url,
              img2.image_url AS image_url_2,
              COALESCE(var.variants, '[]') AS variants
         FROM products p
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN LATERAL (
           SELECT image_url FROM product_images
           WHERE product_id = p.id AND is_primary = TRUE
           ORDER BY sort_order LIMIT 1
         ) img ON TRUE
         LEFT JOIN LATERAL (
           SELECT image_url FROM product_images
           WHERE product_id = p.id AND NOT is_primary
           ORDER BY sort_order LIMIT 1
         ) img2 ON TRUE
         LEFT JOIN LATERAL (
           SELECT json_agg(
             json_build_object('id', v.id, 'size', v.size, 'color', v.color,
                               'image_url', v.image_url, 'price', v.price)
             ORDER BY v.size, v.color
           ) AS variants
           FROM product_variants v
           WHERE v.product_id = p.id AND v.is_active = TRUE
         ) var ON TRUE
        WHERE ${where.join(' AND ')}
        ORDER BY p.is_featured DESC, p.id`,
      params
    );
    res.json({
      products: rows.map(r => ({ ...r, variants: r.variants === '[]' ? [] : r.variants }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.slug, p.description, p.price, p.old_price,
              p.badge, p.material, p.is_featured, p.stock_qty,
              c.name AS category_name, c.slug AS category_slug
         FROM products p
         JOIN categories c ON c.id = p.category_id
        WHERE p.slug = $1 AND p.is_active = TRUE`,
      [req.params.slug]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const variants = await pool.query(
      `SELECT id, size, color, image_url, price, stock_qty, is_active
         FROM product_variants
        WHERE product_id = $1 AND is_active = TRUE
        ORDER BY size, color`,
      [rows[0].id]
    );

    const images = await pool.query(
      `SELECT id, image_url, alt_text, is_primary, sort_order
         FROM product_images WHERE product_id = $1 ORDER BY sort_order`,
      [rows[0].id]
    );
    const reviews = await pool.query(
      `SELECT id, customer_name, rating, comment, is_verified, created_at
         FROM reviews WHERE product_id = $1 AND is_active = TRUE ORDER BY created_at DESC`,
      [rows[0].id]
    );
    res.json({ product: { ...rows[0], images: images.rows, variants: variants.rows, reviews: reviews.rows } });
  } catch (err) {
    next(err);
  }
});

export default router;
