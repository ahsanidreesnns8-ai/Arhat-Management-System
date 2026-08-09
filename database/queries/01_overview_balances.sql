-- ============================================================
-- 01) COMPANY OVERVIEW — all money at a glance
-- ============================================================
USE rehmani_trading;

SELECT
  (SELECT COALESCE(SUM(outstanding_balance), 0) FROM farmers WHERE deleted = FALSE) AS total_farmer_payable_remaining,
  (SELECT COALESCE(SUM(outstanding_balance), 0) FROM buyers WHERE deleted = FALSE) AS total_buyer_receivable_remaining,
  (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_type = 'FARMER') AS total_paid_to_farmers,
  (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_type = 'BUYER') AS total_received_from_buyers,
  (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE deleted = FALSE) AS total_sales_billed,
  (SELECT COALESCE(SUM(paid_amount), 0) FROM sales WHERE deleted = FALSE) AS total_sales_cash_received,
  (SELECT COALESCE(SUM(farmer_receivable), 0) FROM dheris WHERE deleted = FALSE) AS total_dheri_farmer_receivable,
  (SELECT COALESCE(SUM(commission_amount), 0) FROM dheris WHERE deleted = FALSE) AS total_commission_earned,
  (SELECT COALESCE(SUM(arhat_share), 0) FROM dheris WHERE deleted = FALSE) AS total_arhat_share;
