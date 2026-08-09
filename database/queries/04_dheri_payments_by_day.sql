-- ============================================================
-- 04) DHERI PAYMENT RECORDS BY DAY
-- ============================================================
USE rehmani_trading;

-- Change this date as needed
SET @day = CURDATE();           -- or e.g. '2026-08-09'
-- Optional: filter one dheri code, or leave NULL for all
SET @dheri_code = NULL;         -- e.g. 'DHR00001'

-- A) All dheris with payable + payments on selected day
SELECT
  d.dheri_id,
  f.name AS farmer_name,
  pr.name AS product,
  d.farmer_receivable,
  d.selling_status,
  p.payment_date,
  p.amount AS payment_amount,
  p.payment_method,
  p.notes
FROM dheris d
JOIN farmers f ON f.id = d.farmer_id
JOIN products pr ON pr.id = d.product_id
LEFT JOIN payments p
  ON p.dheri_id = d.id
 AND p.payment_date = @day
WHERE d.deleted = FALSE
  AND (@dheri_code IS NULL OR d.dheri_id = @dheri_code)
ORDER BY d.dheri_id, p.id;

-- B) Only payments that happened on that day (cashbook for dheris)
SELECT
  p.payment_date,
  p.payment_type,
  d.dheri_id,
  COALESCE(f.name, b.name) AS party_name,
  p.amount,
  p.payment_method,
  s.invoice_number,
  p.notes
FROM payments p
LEFT JOIN dheris d ON d.id = p.dheri_id
LEFT JOIN farmers f ON f.id = p.farmer_id
LEFT JOIN buyers b ON b.id = p.buyer_id
LEFT JOIN sales s ON s.id = p.sale_id
WHERE p.payment_date = @day
ORDER BY p.created_at;

-- C) One specific dheri full payment history (replace id)
-- SELECT * FROM payments WHERE dheri_id = 1 ORDER BY payment_date DESC;
