-- ============================================================
-- 07) DAY CASHBOOK — money in / money out on one day
-- ============================================================
USE rehmani_trading;

SET @day = CURDATE();   -- change to e.g. '2026-08-09'

SELECT
  'IN' AS direction,
  p.payment_date,
  'BUYER_RECEIPT' AS category,
  b.name AS party,
  d.dheri_id,
  s.invoice_number,
  p.amount,
  p.payment_method,
  p.notes
FROM payments p
JOIN buyers b ON b.id = p.buyer_id
LEFT JOIN dheris d ON d.id = p.dheri_id
LEFT JOIN sales s ON s.id = p.sale_id
WHERE p.payment_type = 'BUYER'
  AND p.payment_date = @day

UNION ALL

SELECT
  'OUT' AS direction,
  p.payment_date,
  'FARMER_PAYOUT' AS category,
  f.name AS party,
  d.dheri_id,
  NULL AS invoice_number,
  p.amount,
  p.payment_method,
  p.notes
FROM payments p
JOIN farmers f ON f.id = p.farmer_id
LEFT JOIN dheris d ON d.id = p.dheri_id
WHERE p.payment_type = 'FARMER'
  AND p.payment_date = @day

ORDER BY direction, payment_date, party;

-- Totals for the day
SELECT
  COALESCE(SUM(CASE WHEN payment_type = 'BUYER' THEN amount END), 0) AS cash_in,
  COALESCE(SUM(CASE WHEN payment_type = 'FARMER' THEN amount END), 0) AS cash_out,
  COALESCE(SUM(CASE WHEN payment_type = 'BUYER' THEN amount END), 0)
    - COALESCE(SUM(CASE WHEN payment_type = 'FARMER' THEN amount END), 0) AS net_cash
FROM payments
WHERE payment_date = @day;
