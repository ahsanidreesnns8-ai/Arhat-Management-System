-- ============================================================
-- 06) STOCK LEVELS + HISTORY
-- ============================================================
USE rehmani_trading;

SELECT
  p.product_code,
  p.name AS product,
  s.quantity AS current_qty_kg,
  s.low_stock_alert,
  CASE WHEN s.low_stock_alert = TRUE OR s.quantity < (
    SELECT low_stock_threshold FROM business_settings LIMIT 1
  ) THEN 'LOW' ELSE 'OK' END AS stock_status
FROM stock s
JOIN products p ON p.id = s.product_id
WHERE p.deleted = FALSE
ORDER BY p.name;

SELECT
  st.created_at,
  p.name AS product,
  st.transaction_type,
  st.quantity,
  st.reference_type,
  st.notes
FROM stock_transactions st
JOIN products p ON p.id = st.product_id
ORDER BY st.created_at DESC
LIMIT 200;
