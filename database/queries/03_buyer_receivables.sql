-- ============================================================
-- 03) BUYER RECEIVABLES — invoices + payments
-- ============================================================
USE rehmani_trading;

-- A) Buyer summary
SELECT
  b.id,
  b.buyer_id,
  b.name,
  b.phone,
  b.city,
  b.outstanding_balance AS remaining_receivable,
  COALESCE((
    SELECT SUM(s.total_amount) FROM sales s
    WHERE s.buyer_id = b.id AND s.deleted = FALSE
  ), 0) AS total_billed,
  COALESCE((
    SELECT SUM(p.amount) FROM payments p
    WHERE p.buyer_id = b.id AND p.payment_type = 'BUYER'
  ), 0) AS total_paid_by_buyer
FROM buyers b
WHERE b.deleted = FALSE
ORDER BY b.outstanding_balance DESC, b.name;

-- B) Sale invoices
SELECT
  s.invoice_number,
  s.sale_date,
  b.buyer_id,
  b.name AS buyer_name,
  s.total_bags,
  s.total_amount,
  s.paid_amount,
  (s.total_amount - s.paid_amount) AS remaining,
  s.payment_status
FROM sales s
JOIN buyers b ON b.id = s.buyer_id
WHERE s.deleted = FALSE
ORDER BY s.sale_date DESC, s.id DESC;

-- C) Sale line items (product details)
SELECT
  s.invoice_number,
  s.sale_date,
  b.name AS buyer,
  pr.name AS product,
  si.source_type,
  f.name AS farmer_name,
  d.dheri_id,
  si.number_of_bags,
  si.total_weight,
  si.rate AS rate_per_40kg,
  si.amount
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
JOIN buyers b ON b.id = s.buyer_id
JOIN products pr ON pr.id = si.product_id
LEFT JOIN farmers f ON f.id = si.farmer_id
LEFT JOIN dheris d ON d.id = si.dheri_id
WHERE s.deleted = FALSE
ORDER BY s.sale_date DESC, s.id DESC, si.id;
