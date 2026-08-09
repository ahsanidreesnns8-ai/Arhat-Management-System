-- ============================================================
-- 05) SALES + COMMISSION SHARES
-- Commission of TOTAL amount: Arhat 3% + Munshi 0.70% + Workers 0.30%
-- ============================================================
USE rehmani_trading;

SELECT
  d.dheri_id,
  DATE(d.created_at) AS dheri_date,
  f.name AS farmer,
  pr.name AS product,
  d.total_price AS gross_amount,
  d.commission_percentage,
  d.commission_amount,
  d.farmer_receivable,
  d.arhat_share,
  d.supervisor_share,
  d.labor_share,
  d.selling_status
FROM dheris d
JOIN farmers f ON f.id = d.farmer_id
JOIN products pr ON pr.id = d.product_id
WHERE d.deleted = FALSE
ORDER BY d.created_at DESC;

SELECT
  s.sale_date,
  s.invoice_number,
  b.name AS buyer,
  s.total_amount,
  s.paid_amount,
  s.payment_status
FROM sales s
JOIN buyers b ON b.id = s.buyer_id
WHERE s.deleted = FALSE
ORDER BY s.sale_date DESC;
