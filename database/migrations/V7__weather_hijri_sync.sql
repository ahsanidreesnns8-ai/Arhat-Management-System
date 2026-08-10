-- Area weather, Islamic calendar adjustment, and multi-user sync pulse

ALTER TABLE business_settings
    ADD COLUMN weather_latitude DECIMAL(10, 6) NOT NULL DEFAULT 31.520400,
    ADD COLUMN weather_longitude DECIMAL(10, 6) NOT NULL DEFAULT 74.358700,
    ADD COLUMN weather_location_label VARCHAR(120) NOT NULL DEFAULT 'Lahore',
    ADD COLUMN weather_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Karachi',
    ADD COLUMN hijri_adjustment_days INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sync_state (
    id BIGINT PRIMARY KEY,
    revision BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO sync_state (id, revision)
SELECT 1, 1
WHERE NOT EXISTS (SELECT 1 FROM sync_state WHERE id = 1);
