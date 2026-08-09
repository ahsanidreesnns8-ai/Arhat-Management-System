-- ============================================================
-- 02) FARMER PAYABLES — product / dheri detail + payments
-- ============================================================
USE rehmani_trading;

-- A) Farmer summary (payable remaining)
SELECT
  f.id,
  f.farmer_id,
  f.name,
  f.phone,
  f.city,
  f.outstanding_balance AS remaining_payable,
  COALESCE((
    SELECT SUM(d.farmer_receivable)
    FROM dheris d
    WHERE d.farmer_id = f.id AND d.deleted = FALSE
  ), 0) AS total_product_payable,
  COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.farmer_id = f.id AND p.payment_type = 'FARMER'
  ), 0) AS total_paid_to_farmer
FROM farmers f
WHERE f.deleted = FALSE
ORDER BY f.outstanding_balance DESC, f.name;

-- B) Every dheri / product for farmers
SELECT
  f.farmer_id,
  f.name AS farmer_name,
  d.dheri_id,
  pr.name AS product,
  d.number_of_bags,
  d.total_weight,
  d.market_rate AS rate_per_40kg,
  d.total_price,
  d.commission_amount,
  d.farmer_receivable AS payable_after_commission,
  d.payable_posted,
  d.selling_status,
  DATE(d.created_at) AS dheri_date
FROM dheris d
JOIN farmers f ON f.id = d.farmer_id
JOIN products pr ON pr.id = d.product_id
WHERE d.deleted = FALSE
ORDER BY d.created_at DESC;

-- C) Payments made to farmers (with dheri + date)
SELECT
  p.payment_date,
  f.farmer_id,
  f.name AS farmer_name,
  d.dheri_id,
  p.amount,
  p.payment_method,
  p.reference_number,
  p.notes,
  p.status
FROM payments p
JOIN farmers f ON f.id = p.farmer_id
LEFT JOIN dheris d ON d.id = p.dheri_id
WHERE p.payment_type = 'FARMER'
ORDER BY p.payment_date DESC, p.id DESC;
