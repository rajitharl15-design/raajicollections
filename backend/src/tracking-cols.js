import pool from './db.js';

let hasTrackingColsCache = null;

export async function hasTrackingColumns() {
  if (hasTrackingColsCache !== null) return hasTrackingColsCache;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders'
          AND column_name IN ('tracking_carrier', 'tracking_number')
        LIMIT 1`
    );
    hasTrackingColsCache = rows.length > 0;
  } catch (err) {
    hasTrackingColsCache = false;
  }
  return hasTrackingColsCache;
}
