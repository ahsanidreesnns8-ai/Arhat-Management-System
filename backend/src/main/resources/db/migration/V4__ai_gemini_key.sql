ALTER TABLE business_settings
    ADD COLUMN gemini_api_key VARCHAR(255) NULL AFTER payment_reminder_days;
