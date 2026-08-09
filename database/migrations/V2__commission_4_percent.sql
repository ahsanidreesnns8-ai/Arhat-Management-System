-- Update default commission to 4% per business spec
UPDATE business_settings SET default_commission_percentage = 4.00 WHERE default_commission_percentage = 2.00;

ALTER TABLE business_settings ALTER COLUMN default_commission_percentage SET DEFAULT 4.00;
ALTER TABLE dheris ALTER COLUMN commission_percentage SET DEFAULT 4.00;
