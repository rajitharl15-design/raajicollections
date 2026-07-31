import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/categories
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.slug, c.description, c.image_url, c.sort_order,
              COUNT(p.id)::int AS product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
        WHERE c.is_active = TRUE
        GROUP BY c.id
        ORDER BY c.sort_order`
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
