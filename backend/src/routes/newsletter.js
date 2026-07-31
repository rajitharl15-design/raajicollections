import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO newsletter_subscribers (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET is_active = TRUE
       RETURNING id, email`,
      [email.toLowerCase()]
    );
    res.status(201).json({ subscribed: true, email: rows[0].email });
  } catch (err) {
    next(err);
  }
});

export default router;
