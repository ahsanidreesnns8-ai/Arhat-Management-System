-- Commission shares are now % of TOTAL AMOUNT (not % of commission pool):
-- Arhat 3%, Munshi/Nigran 0.70%, Workers 0.30%  => total commission 4%
UPDATE business_settings
SET arhat_share_percentage = 3.00,
    supervisor_share_percentage = 0.70,
    labor_share_percentage = 0.30,
    default_commission_percentage = 4.00;

ALTER TABLE business_settings
    ALTER COLUMN arhat_share_percentage SET DEFAULT 3.00,
    ALTER COLUMN supervisor_share_percentage SET DEFAULT 0.70,
    ALTER COLUMN labor_share_percentage SET DEFAULT 0.30,
    ALTER COLUMN default_commission_percentage SET DEFAULT 4.00;

ALTER TABLE dheris
    ALTER COLUMN commission_percentage SET DEFAULT 4.00;
